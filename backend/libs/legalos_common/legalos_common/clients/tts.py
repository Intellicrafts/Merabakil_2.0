"""Gemini text-to-speech client with offline stub."""

from __future__ import annotations

import base64
import json
import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

import httpx

from legalos_common.config import LLMSettings

logger = logging.getLogger(__name__)

_GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
_SAMPLE_RATE = 24_000


class TTSClient(ABC):
    @abstractmethod
    async def stream_speech(self, text: str, *, voice: str | None = None) -> AsyncIterator[bytes]: ...

    @property
    def sample_rate(self) -> int:
        return _SAMPLE_RATE


class StubTTSClient(TTSClient):
    """Signals stub mode; frontend should fall back to Web Speech API."""

    async def stream_speech(self, text: str, *, voice: str | None = None) -> AsyncIterator[bytes]:
        if False:  # pragma: no cover - makes this a generator
            yield b""
        raise RuntimeError("TTS stub mode; use browser speech synthesis fallback")


class GeminiTTSClient(TTSClient):
    def __init__(self, settings: LLMSettings) -> None:
        self._settings = settings

    def _model(self) -> str:
        return self._settings.tts_model

    def _voice(self, voice: str | None) -> str:
        return voice or self._settings.tts_voice

    def _request_body(self, text: str, voice: str) -> dict:
        return {
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {"voiceName": voice},
                    }
                },
            },
        }

    async def _synthesize_chunk(self, text: str, voice: str) -> bytes:
        url = f"{_GEMINI_API_BASE}/models/{self._model()}:generateContent"
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                url,
                params={"key": self._settings.llm_api_key},
                json=self._request_body(text, voice),
            )
            if resp.status_code != 200:
                logger.warning(
                    "gemini_tts_sync_error status=%s model=%s body=%s",
                    resp.status_code,
                    self._model(),
                    resp.text[:200],
                )
            resp.raise_for_status()
            data = resp.json()
        return self._extract_pcm(data)

    @staticmethod
    def _extract_pcm(data: dict) -> bytes:
        candidates = data.get("candidates") or []
        for candidate in candidates:
            content = candidate.get("content") or {}
            for part in content.get("parts") or []:
                inline = part.get("inlineData") or part.get("inline_data")
                if not inline:
                    continue
                raw = inline.get("data")
                if raw:
                    return base64.b64decode(raw)
        raise ValueError("No audio data in Gemini TTS response")

    async def stream_speech(self, text: str, *, voice: str | None = None) -> AsyncIterator[bytes]:
        selected_voice = self._voice(voice)
        model = self._model()

        # Try streaming endpoint first (works for all Gemini TTS models).
        url = f"{_GEMINI_API_BASE}/models/{model}:streamGenerateContent"
        params = {"key": self._settings.llm_api_key, "alt": "sse"}
        body = self._request_body(text, selected_voice)
        yielded = False

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, params=params, json=body) as resp:
                    if resp.status_code != 200:
                        logger.warning(
                            "gemini_tts_stream_error status=%s model=%s",
                            resp.status_code,
                            model,
                        )
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
                        try:
                            pcm = self._extract_pcm(chunk)
                            if pcm:
                                yielded = True
                                yield pcm
                        except ValueError:
                            continue
        except httpx.HTTPStatusError as exc:
            logger.warning("gemini_tts_stream_http_error model=%s error=%s", model, exc)
            yielded = False

        if not yielded:
            # Fallback: non-streaming generateContent (works for most standard models).
            logger.debug("gemini_tts_fallback_to_sync model=%s", model)
            pcm = await self._synthesize_chunk(text, selected_voice)
            if pcm:
                yield pcm


def build_tts_client(settings: LLMSettings | None = None) -> TTSClient:
    from legalos_common.config import get_common_settings

    resolved = settings or get_common_settings().llm
    if resolved.llm_use_stub or not resolved.llm_api_key:
        return StubTTSClient()
    return GeminiTTSClient(resolved)
