"""Gemini vision fallback for image text extraction."""

from __future__ import annotations

import base64
from pathlib import PurePath

import httpx

from app.config import get_settings
from legalos_common.logging import get_logger

logger = get_logger(__name__)

_GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
_VISION_PROMPT = (
    "Extract all visible text from this image and describe the document content clearly. "
    "If this is a legal document, notice, contract, or form, summarize the key points. "
    "Return plain text only."
)


def _gemini_model_name(model: str) -> str:
    return model.removeprefix("models/").removeprefix("google/")


def _mime_for_image(filename: str | None, content_type: str | None) -> str:
    ctype = (content_type or "").lower()
    if ctype.startswith("image/"):
        return ctype
    suffix = PurePath(filename or "").suffix.lower()
    if suffix in {".png"}:
        return "image/png"
    if suffix in {".webp"}:
        return "image/webp"
    return "image/jpeg"


def describe_image_with_gemini(
    data: bytes,
    *,
    filename: str | None = None,
    content_type: str | None = None,
) -> str:
    settings = get_settings()
    llm = settings.llm
    api_key = llm.llm_api_key
    if not api_key or llm.llm_use_stub:
        return ""

    model = _gemini_model_name(llm.llm_model)
    mime = _mime_for_image(filename, content_type)
    encoded = base64.b64encode(data).decode("ascii")
    url = f"{_GEMINI_API_BASE}/models/{model}:generateContent"
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": _VISION_PROMPT},
                    {"inline_data": {"mime_type": mime, "data": encoded}},
                ],
            }
        ],
        "generationConfig": {"temperature": 0.1},
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            resp = client.post(url, params={"key": api_key}, json=body)
            resp.raise_for_status()
            payload = resp.json()
    except Exception as exc:
        logger.warning("gemini_vision_failed error=%s", exc)
        return ""

    parts: list[str] = []
    for candidate in payload.get("candidates") or []:
        content = candidate.get("content") or {}
        for part in content.get("parts") or []:
            text = part.get("text")
            if text:
                parts.append(text)
    return "\n".join(parts).strip()
