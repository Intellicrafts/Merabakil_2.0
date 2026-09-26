"""Research HTTP routes — Saarthi chat (member, guest, document), speech and sessions."""

from __future__ import annotations

import base64
import json
import logging
import os
import struct
import uuid
from collections.abc import AsyncIterator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from app.api.chat_pipeline import (
    ERROR_MESSAGES,
    SSE_HEADERS,
    ChatRequest,
    chat_stream,
    scoped_session_id,
)
from app.api.deps import (
    enforce_chat_limits,
    enforce_guest_chat_quota,
    enforce_transcribe_limits,
    guest_voice_rate_limit,
    member_user,
    tts_rate_limit,
)
from app.api.schemas import ResearchRequest, ResearchResponse, TtsRequest
from app.infrastructure.container import get_container
from legalos_common.api.errors import ValidationFailedError
from legalos_common.clients.llm import ChatMessage
from legalos_common.clients.tts import StubTTSClient
from legalos_common.security.jwt import create_scoped_token, decode_token
from legalos_common.security.rbac import GUEST_ROLE, CurrentUser, Permission, bearer_scheme
from legalos_common.speech.locales import get_speech_locale
from legalos_common.speech.prepare import prepare_speech_chunks, prepare_speech_text

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/research", tags=["research"])

GUEST_VOICE_TOKEN_TTL = 150
GUEST_VOICE_MAX_SECONDS = 90
_AUDIO_MAX_BYTES = 10 * 1024 * 1024
_AUDIO_TYPES = ("audio/", "video/webm")  # MediaRecorder on some browsers labels webm audio as video


# ── Chat ──────────────────────────────────────────────────────────────────────


def _stream_response(req: ChatRequest, headers: dict | None = None) -> StreamingResponse:
    return StreamingResponse(
        chat_stream(req),
        media_type="text/event-stream",
        headers={**SSE_HEADERS, **(headers or {})},
    )


async def _collect(req: ChatRequest) -> ResearchResponse:
    """Run the streaming pipeline to completion for the JSON endpoints."""
    done: dict | None = None
    error: dict | None = None
    async for chunk in chat_stream(req):
        event, _, data = chunk.partition("\ndata: ")
        if event == "event: done":
            done = json.loads(data)
        elif event == "event: error":
            error = json.loads(data)
    if done is None:
        code = (error or {}).get("code", "server_error")
        status_code = {"rejected": 422, "insufficient_balance": 402}.get(code, 503)
        raise HTTPException(status_code=status_code, detail=ERROR_MESSAGES.get(code, "Request failed."))
    done.pop("mode", None)
    return ResearchResponse.model_validate(done)


@router.post("", response_model=ResearchResponse, summary="Grounded legal research (JSON)")
async def research(
    body: ResearchRequest,
    current_user: CurrentUser = Depends(member_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ResearchResponse:
    await enforce_chat_limits(current_user)
    return await _collect(
        ChatRequest(body=body, token=credentials.credentials, user=current_user, is_guest=False)
    )


@router.post(
    "/document/{document_id}",
    response_model=ResearchResponse,
    summary="Research scoped to a single uploaded document (JSON)",
)
async def research_document(
    document_id: uuid.UUID,
    body: ResearchRequest,
    current_user: CurrentUser = Depends(member_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ResearchResponse:
    await enforce_chat_limits(current_user)
    return await _collect(
        ChatRequest(
            body=body,
            token=credentials.credentials,
            user=current_user,
            is_guest=False,
            document_id=str(document_id),
        )
    )


@router.post("/stream", summary="Stream grounded legal research (SSE)")
async def research_stream(
    body: ResearchRequest,
    current_user: CurrentUser = Depends(member_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StreamingResponse:
    await enforce_chat_limits(current_user)
    return _stream_response(
        ChatRequest(body=body, token=credentials.credentials, user=current_user, is_guest=False)
    )


@router.post("/document/{document_id}/stream", summary="Stream research scoped to one document")
async def research_document_stream(
    document_id: uuid.UUID,
    body: ResearchRequest,
    current_user: CurrentUser = Depends(member_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StreamingResponse:
    container = get_container()
    await enforce_chat_limits(current_user)
    if not await container.document_texts.can_access(str(document_id), user_token=credentials.credentials):
        raise HTTPException(status_code=404, detail="Document not found.")
    return _stream_response(
        ChatRequest(
            body=body,
            token=credentials.credentials,
            user=current_user,
            is_guest=False,
            document_id=str(document_id),
        )
    )


@router.post(
    "/stream/guest",
    summary="Guest (logged-out) research — 5/day per IP, no billing, no lawyers or booking",
)
async def research_stream_guest(body: ResearchRequest, request: Request) -> StreamingResponse:
    """Anonymous free-trial chat. A short-lived token scoped to search only lets KB
    retrieval work; guests get research tools only and their memory is namespaced."""
    remaining = await enforce_guest_chat_quota(request)
    guest_token = create_scoped_token(
        GUEST_ROLE,
        roles=[GUEST_ROLE],
        permissions=[Permission.SEARCH_READ.value],
        expires_seconds=300,
    )
    return _stream_response(
        ChatRequest(body=body, token=guest_token, user=None, is_guest=True),
        headers={
            "X-Guest-Remaining": str(remaining),
            "Access-Control-Expose-Headers": "X-Guest-Remaining",
        },
    )


@router.post("/voice/guest-token", summary="Mint a single-use guest voice token (1/day per IP)")
async def guest_voice_token(request: Request, _rl: None = Depends(guest_voice_rate_limit)) -> dict:
    """Single-use, short-lived token for the voice WebSocket. The WS consumes its
    jti once and hard-caps the session. Kill switch: GUEST_VOICE_ENABLED=false."""
    if os.environ.get("GUEST_VOICE_ENABLED", "true").lower() != "true":
        raise HTTPException(status_code=404, detail="Guest voice is disabled")
    token = create_scoped_token(
        GUEST_ROLE,
        roles=[GUEST_ROLE],
        permissions=[Permission.SEARCH_READ.value],
        expires_seconds=GUEST_VOICE_TOKEN_TTL,
    )
    container = get_container()
    if container.redis:
        jti = decode_token(token).jti
        await container.redis.set(f"voice:guest:jti:{jti}", "1", ex=GUEST_VOICE_TOKEN_TTL)
    return {"token": token, "max_duration_seconds": GUEST_VOICE_MAX_SECONDS}


# ── Sessions (conversation memory) ────────────────────────────────────────────


class _AttachDocumentRequest(BaseModel):
    document_id: str


class _TruncateRequest(BaseModel):
    keep_turns: int = Field(ge=0, le=200)


def _member_sid(session_id: str, user: CurrentUser) -> str:
    return scoped_session_id(session_id, user_id=user.user_id, is_guest=False) or ""


@router.post("/sessions/{session_id}/documents", summary="Attach an uploaded document to a session")
async def attach_session_document(
    session_id: str,
    body: _AttachDocumentRequest,
    current_user: CurrentUser = Depends(member_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    container = get_container()
    if not await container.document_texts.can_access(body.document_id, user_token=credentials.credentials):
        raise HTTPException(status_code=404, detail="Document not found.")
    sid = _member_sid(session_id, current_user)
    await container.session_documents.attach(sid, body.document_id)
    return {"session_id": session_id, "document_ids": await container.session_documents.get(sid)}


@router.get("/sessions/{session_id}/documents", summary="List documents attached to a session")
async def get_session_documents(session_id: str, current_user: CurrentUser = Depends(member_user)) -> dict:
    container = get_container()
    doc_ids = await container.session_documents.get(_member_sid(session_id, current_user))
    return {"session_id": session_id, "document_ids": doc_ids}


@router.delete(
    "/sessions/{session_id}/documents/{document_id}",
    status_code=204,
    summary="Remove a document from a session's context",
)
async def detach_session_document(
    session_id: str, document_id: str, current_user: CurrentUser = Depends(member_user)
) -> None:
    container = get_container()
    await container.session_documents.remove(_member_sid(session_id, current_user), document_id)


@router.post("/sessions/{session_id}/truncate", status_code=204, summary="Rewind session memory")
async def truncate_session(
    session_id: str, body: _TruncateRequest, current_user: CurrentUser = Depends(member_user)
) -> None:
    """Keep the first ``keep_turns`` turns — used by edit-and-resend so the model
    no longer sees the discarded exchange."""
    container = get_container()
    await container.memory_manager.truncate_session(_member_sid(session_id, current_user), body.keep_turns)


@router.delete("/sessions/{session_id}", status_code=204, summary="Forget a conversation")
async def forget_session(session_id: str, current_user: CurrentUser = Depends(member_user)) -> None:
    """Called when a user deletes a chat: drops its history, attachments and the
    long-term facts learned from it."""
    container = get_container()
    sid = _member_sid(session_id, current_user)
    await container.memory_manager.forget_session(sid, current_user.user_id)
    for doc_id in await container.session_documents.get(sid):
        await container.session_documents.remove(sid, doc_id)


@router.delete("/memory", status_code=204, summary="Erase everything Saarthi remembers about me")
async def forget_me(current_user: CurrentUser = Depends(member_user)) -> None:
    await get_container().memory_manager.forget_user(current_user.user_id)


# ── Speech-to-text ────────────────────────────────────────────────────────────

_TRANSCRIBE_PROMPT = (
    "Transcribe this audio exactly as spoken, in the language spoken. Return only the "
    "transcription text, with no labels, commentary, or formatting."
)


async def _read_audio(audio: UploadFile) -> tuple[bytes, str]:
    mime = (audio.content_type or "audio/webm").split(";")[0].strip()
    if not mime.startswith(_AUDIO_TYPES):
        raise HTTPException(status_code=415, detail="Unsupported audio format.")
    data = await audio.read(_AUDIO_MAX_BYTES + 1)
    if not data:
        raise HTTPException(status_code=422, detail="Empty audio file.")
    if len(data) > _AUDIO_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Recording is too long. Please keep it under a few minutes.")
    return data, mime


def _transcribe_request(data: bytes, mime: str) -> tuple[str, dict, dict]:
    container = get_container()
    llm_cfg = container.settings.llm
    if not llm_cfg.llm_api_key:
        raise HTTPException(status_code=503, detail="Transcription unavailable.")
    model = (llm_cfg.llm_fast_model or llm_cfg.llm_model).removeprefix("models/")
    headers = {"x-goog-api-key": llm_cfg.llm_api_key, "Content-Type": "application/json"}
    body = {
        "contents": [{
            "parts": [
                {"inlineData": {"mimeType": mime, "data": base64.b64encode(data).decode()}},
                {"text": _TRANSCRIBE_PROMPT},
            ]
        }]
    }
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model}", headers, body


@router.post("/transcribe", summary="Transcribe an audio recording to text")
async def transcribe_audio(audio: UploadFile, current_user: CurrentUser = Depends(member_user)) -> dict:
    await enforce_transcribe_limits(current_user)
    data, mime = await _read_audio(audio)
    base, headers, body = _transcribe_request(data, mime)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{base}:generateContent", headers=headers, json=body)
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Transcription timed out. Please try again.") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Transcription service error.") from exc
    if resp.is_error:
        logger.warning("transcribe_audio_provider_error status=%s", resp.status_code)
        raise HTTPException(status_code=502, detail="Transcription service error.")

    candidates = resp.json().get("candidates", [])
    parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
    transcript = "".join(p.get("text", "") for p in parts).strip()
    if not transcript:
        raise HTTPException(status_code=422, detail="Could not transcribe audio.")
    return {"transcript": transcript}


@router.post("/transcribe/stream", summary="Stream transcription of an audio recording")
async def transcribe_audio_stream(
    audio: UploadFile, current_user: CurrentUser = Depends(member_user)
) -> StreamingResponse:
    await enforce_transcribe_limits(current_user)
    data, mime = await _read_audio(audio)
    base, headers, body = _transcribe_request(data, mime)

    async def generator() -> AsyncIterator[str]:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream(
                    "POST", f"{base}:streamGenerateContent", headers=headers, params={"alt": "sse"}, json=body
                ) as resp:
                    if resp.is_error:
                        yield "event: error\ndata: " + json.dumps({"message": "Transcription failed."}) + "\n\n"
                        return
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
                        parts = (chunk.get("candidates") or [{}])[0].get("content", {}).get("parts", [])
                        token = "".join(p.get("text", "") for p in parts)
                        if token:
                            yield "event: token\ndata: " + json.dumps({"text": token}) + "\n\n"
        except httpx.HTTPError:
            yield "event: error\ndata: " + json.dumps({"message": "Transcription failed."}) + "\n\n"
            return
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Text-to-speech ────────────────────────────────────────────────────────────


async def _maybe_rewrite_for_speech(text: str, *, rewrite: bool, language: str) -> str:
    locale = get_speech_locale(language)
    if not rewrite or (len(text) <= 800 and locale.code == "en-IN"):
        return text
    container = get_container()
    if isinstance(container.tts, StubTTSClient):
        return text
    try:
        script = await container.llm_fast.complete(
            [
                ChatMessage(role="system", content=locale.rewrite_prompt),
                ChatMessage(role="user", content=text),
            ],
            temperature=0.3,
        )
    except Exception as exc:
        logger.warning("tts_rewrite_failed error=%s", type(exc).__name__)
        return text
    return script.strip() or text


def _frame_pcm(chunk: bytes) -> bytes:
    return struct.pack("<I", len(chunk)) + chunk


async def _collect_sentence(tts, sentence: str, voice: str) -> list[bytes]:
    frames: list[bytes] = []
    try:
        async for pcm in tts.stream_speech(sentence, voice=voice):
            frames.append(_frame_pcm(pcm))
    except Exception as exc:
        logger.warning("tts_chunk_error error=%s", exc)
    return frames


async def _tts_byte_stream(text: str, *, voice: str) -> AsyncIterator[bytes]:
    import asyncio

    container = get_container()
    chunks = prepare_speech_chunks(text)
    if not chunks:
        return
    # Synthesise sentences 2+ in the background while sentence 1 streams.
    prefetch = [asyncio.create_task(_collect_sentence(container.tts, s, voice=voice)) for s in chunks[1:]]
    try:
        try:
            async for pcm in container.tts.stream_speech(chunks[0], voice=voice):
                yield _frame_pcm(pcm)
        except Exception as exc:
            logger.warning("tts_chunk_error error=%s", exc)
        for task in prefetch:
            for framed in await task:
                yield framed
    finally:
        for task in prefetch:  # listener left early — stop paying for synthesis
            if not task.done():
                task.cancel()


@router.post("/tts/stream", summary="Stream natural speech audio for a legal answer")
async def tts_stream(body: TtsRequest, _: CurrentUser = Depends(tts_rate_limit)) -> StreamingResponse:
    prepared = prepare_speech_text(body.text)
    if not prepared:
        raise ValidationFailedError("No speakable text after preprocessing.")

    container = get_container()
    if isinstance(container.tts, StubTTSClient):
        raise HTTPException(status_code=503, detail="TTS unavailable in stub mode")

    locale = get_speech_locale(body.language)
    speak_text = await _maybe_rewrite_for_speech(prepared, rewrite=body.rewrite_for_speech, language=body.language)

    return StreamingResponse(
        _tts_byte_stream(speak_text, voice=locale.voice),
        media_type="application/octet-stream",
        headers={
            "X-Audio-Sample-Rate": str(container.tts.sample_rate),
            "X-Audio-Format": "pcm_s16le",
            "X-Audio-Channels": "1",
            "X-Speech-Locale": locale.code,
            "Cache-Control": "no-store",
        },
    )
