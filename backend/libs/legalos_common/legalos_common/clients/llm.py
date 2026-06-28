"""Provider-agnostic LLM + embedding clients (OpenAI-compatible by default).

A deterministic offline stub is available (``LLM_USE_STUB=true``) so the whole
platform can run end-to-end in docker-compose without external API keys.
"""

from __future__ import annotations

import hashlib
import math
import re
from abc import ABC, abstractmethod

import httpx
from pydantic import BaseModel

from legalos_common.config import LLMSettings, get_common_settings

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
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{self._settings.embedding_base_url}/embeddings",
                headers={"Authorization": f"Bearer {self._settings.embedding_api_key}"},
                json={"model": self._settings.embedding_model, "input": texts},
            )
            resp.raise_for_status()
            data = resp.json()["data"]
            return [item["embedding"] for item in data]


# --------------------------------------------------------------------------- #
# Chat / completion
# --------------------------------------------------------------------------- #
class LLMClient(ABC):
    @abstractmethod
    async def complete(self, messages: list[ChatMessage], *, temperature: float = 0.1) -> str: ...


class StubLLMClient(LLMClient):
    """Offline deterministic completion that grounds its answer in supplied context."""

    async def complete(self, messages: list[ChatMessage], *, temperature: float = 0.1) -> str:
        user = next((m for m in reversed(messages) if m.role == "user"), None)
        context_msg = next((m for m in messages if m.role == "system"), None)
        question = user.content if user else ""
        grounded = (
            "Based on the retrieved legal sources, the following assessment applies. "
            "This response is generated in offline demo mode and is grounded strictly "
            "in the provided context; it is informational and not a substitute for "
            "advice from a licensed advocate.\n\n"
        )
        if context_msg and "CONTEXT:" in context_msg.content:
            snippet = context_msg.content.split("CONTEXT:", 1)[1].strip()[:600]
            grounded += f"Relevant context considered:\n{snippet}\n\n"
        grounded += f"Question addressed: {question.strip()[:300]}"
        return grounded


class OpenAICompatibleLLMClient(LLMClient):
    def __init__(self, settings: LLMSettings) -> None:
        self._settings = settings

    async def complete(self, messages: list[ChatMessage], *, temperature: float = 0.1) -> str:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{self._settings.llm_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self._settings.llm_api_key}"},
                json={
                    "model": self._settings.llm_model,
                    "temperature": temperature,
                    "messages": [m.model_dump() for m in messages],
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]


# --------------------------------------------------------------------------- #
# Factories
# --------------------------------------------------------------------------- #
def build_embedding_client(settings: LLMSettings | None = None) -> EmbeddingClient:
    settings = settings or get_common_settings().llm
    if settings.embedding_use_stub:
        return StubEmbeddingClient(settings.embedding_dim)
    return OpenAICompatibleEmbeddingClient(settings)


def build_llm_client(settings: LLMSettings | None = None) -> LLMClient:
    settings = settings or get_common_settings().llm
    if settings.llm_use_stub:
        return StubLLMClient()
    return OpenAICompatibleLLMClient(settings)
