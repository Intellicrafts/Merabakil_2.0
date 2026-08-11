"""Provider-agnostic LLM + embedding clients (OpenAI-compatible by default).

A deterministic offline stub is available (``LLM_USE_STUB=true``) so the whole
platform can run end-to-end in docker-compose without external API keys.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

import httpx
from pydantic import BaseModel

from legalos_common.config import LLMSettings, get_common_settings
from legalos_common.logging import get_logger

logger = get_logger(__name__)

_WORD_RE = re.compile(r"[a-zA-Z0-9]+")


class ChatMessage(BaseModel):
    role: str
    content: str


# --------------------------------------------------------------------------- #
# Embeddings
# --------------------------------------------------------------------------- #
class EmbeddingClient(ABC):
    def __init__(self, dim: int) -> None:
        self.dim = dim

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]: ...

    async def embed_one(self, text: str) -> list[float]:
        return (await self.embed([text]))[0]


class StubEmbeddingClient(EmbeddingClient):
    """Deterministic bag-of-words hashing embedding, L2-normalised.

    Not semantically powerful, but stable and fully offline - enough to make
    vector search behave sensibly in demos and tests.
    """

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_text(t) for t in texts]

    def _embed_text(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for token in _WORD_RE.findall(text.lower()):
            h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
            idx = h % self.dim
            sign = 1.0 if (h >> 8) % 2 == 0 else -1.0
            vec[idx] += sign
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]


class OpenAICompatibleEmbeddingClient(EmbeddingClient):
    def __init__(self, settings: LLMSettings) -> None:
        super().__init__(settings.embedding_dim)
        self._settings = settings

    async def embed(self, texts: list[str]) -> list[list[float]]:
        base = self._settings.embedding_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{base}/embeddings",
                headers={"Authorization": f"Bearer {self._settings.embedding_api_key}"},
                json={"model": self._settings.embedding_model, "input": texts},
            )
            if resp.is_error:
                detail = resp.text[:400].strip()
                raise httpx.HTTPStatusError(
                    f"Embedding API {resp.status_code} for model "
                    f"{self._settings.embedding_model}: {detail}",
                    request=resp.request,
                    response=resp,
                )
            data = resp.json()["data"]
            return [item["embedding"] for item in data]


# --------------------------------------------------------------------------- #
# Chat / completion
# --------------------------------------------------------------------------- #
class LLMClient(ABC):
    @abstractmethod
    async def complete(self, messages: list[ChatMessage], *, temperature: float = 0.1) -> str: ...

    async def stream_complete(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.1,
    ) -> AsyncIterator[str]:
        text = await self.complete(messages, temperature=temperature)
        yield text


class StubLLMClient(LLMClient):
    """Offline deterministic completion that grounds its answer in supplied context."""

    async def stream_complete(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.1,
    ) -> AsyncIterator[str]:
        text = await self.complete(messages, temperature=temperature)
        step = 48
        for idx in range(0, len(text), step):
            yield text[idx : idx + step]

    async def complete(self, messages: list[ChatMessage], *, temperature: float = 0.1) -> str:
        user = next((m for m in reversed(messages) if m.role == "user"), None)
        context_msg = next((m for m in messages if m.role == "system"), None)
        question = user.content if user else ""
        grounded = (
            "## Summary\n"
            "Based on the retrieved legal sources, the following assessment applies. "
            "This response was generated in **offline fallback mode** because the configured "
            "language model provider is unavailable (check your API key or billing). "
            "It is grounded in the provided context where available and is informational only — "
            "not a substitute for advice from a licensed advocate.\n\n"
        )
        context_text = ""
        if context_msg:
            body = context_msg.content
            for marker in ("CORPUS CONTEXT:", "WEB CONTEXT:", "CONTEXT:"):
                if marker in body:
                    context_text = body.split(marker, 1)[1].strip()[:1200]
                    break
        if context_text:
            grounded += "## Key Points\n"
            grounded += f"{context_text[:900]}\n\n"
        grounded += f"## Question Addressed\n{question.strip()[:400]}"
        return grounded


class OpenAICompatibleLLMClient(LLMClient):
    def __init__(self, settings: LLMSettings) -> None:
        self._settings = settings

    async def stream_complete(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.1,
    ) -> AsyncIterator[str]:
        base = self._settings.llm_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {self._settings.llm_api_key}"},
                json={
                    "model": self._settings.llm_model,
                    "temperature": temperature,
                    "stream": True,
                    "messages": [m.model_dump() for m in messages],
                },
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if not payload or payload == "[DONE]":
                        continue
                    try:
                        chunk = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    token = delta.get("content")
                    if token:
                        yield token

    async def complete(self, messages: list[ChatMessage], *, temperature: float = 0.1) -> str:
        base = self._settings.llm_base_url.rstrip("/")
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {self._settings.llm_api_key}"},
                json={
                    "model": self._settings.llm_model,
                    "temperature": temperature,
                    "messages": [m.model_dump() for m in messages],
                },
            )
            resp.raise_for_status()
            message = resp.json()["choices"][0].get("message") or {}
            content = message.get("content")
            if content is None:
                raise httpx.HTTPError(
                    f"LLM returned empty content for model {self._settings.llm_model}"
                )
            return content


class FallbackEmbeddingClient(EmbeddingClient):
    """Use the primary embedder; fall back to the offline stub on provider errors."""

    def __init__(self, primary: EmbeddingClient, fallback: EmbeddingClient) -> None:
        super().__init__(primary.dim)
        self._primary = primary
        self._fallback = fallback

    async def embed(self, texts: list[str]) -> list[list[float]]:
        try:
            return await self._primary.embed(texts)
        except httpx.HTTPError as exc:
            logger.warning(
                "embedding_primary_failed_using_stub",
                error=str(exc),
            )
            return await self._fallback.embed(texts)


class FallbackLLMClient(LLMClient):
    """Use the primary LLM; fall back to the offline stub on provider errors."""

    def __init__(self, primary: LLMClient, fallback: LLMClient) -> None:
        self._primary = primary
        self._fallback = fallback

    async def stream_complete(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.1,
    ) -> AsyncIterator[str]:
        try:
            async for token in self._primary.stream_complete(messages, temperature=temperature):
                yield token
        except httpx.HTTPError as exc:
            logger.warning(
                "llm_primary_stream_failed_using_stub",
                error=str(exc),
            )
            async for token in self._fallback.stream_complete(messages, temperature=temperature):
                yield token

    async def complete(self, messages: list[ChatMessage], *, temperature: float = 0.1) -> str:
        try:
            return await self._primary.complete(messages, temperature=temperature)
        except httpx.HTTPError as exc:
            logger.warning(
                "llm_primary_complete_failed_using_stub",
                error=str(exc),
            )
            return await self._fallback.complete(messages, temperature=temperature)


# --------------------------------------------------------------------------- #
# Factories
# --------------------------------------------------------------------------- #
def build_embedding_client(settings: LLMSettings | None = None) -> EmbeddingClient:
    settings = settings or get_common_settings().llm
    stub = StubEmbeddingClient(settings.embedding_dim)
    if settings.embedding_use_stub:
        return stub
    return FallbackEmbeddingClient(OpenAICompatibleEmbeddingClient(settings), stub)


def build_llm_client(settings: LLMSettings | None = None) -> LLMClient:
    settings = settings or get_common_settings().llm
    stub = StubLLMClient()
    if settings.llm_use_stub:
        return stub
    return FallbackLLMClient(OpenAICompatibleLLMClient(settings), stub)
