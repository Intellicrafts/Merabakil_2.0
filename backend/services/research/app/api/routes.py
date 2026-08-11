"""Research HTTP routes - runs the multi-agent orchestrator."""

from __future__ import annotations

import struct
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials

from app.api.schemas import ResearchRequest, ResearchResponse, TtsRequest
from app.infrastructure.container import get_container
from legalos_common.api.errors import ValidationFailedError
from legalos_common.clients.llm import ChatMessage
from legalos_common.clients.tts import StubTTSClient
from legalos_common.rag.guardrails import detect_prompt_injection, sanitize_user_input
from legalos_common.security.rbac import (
    CurrentUser,
    Permission,
    bearer_scheme,
    require_permissions,
)
from legalos_common.speech.locales import get_speech_locale
from legalos_common.speech.prepare import prepare_speech_chunks, prepare_speech_text
from legalos_orchestrator.schemas import ConversationMessage, OrchestratorState, ResearchScope

router = APIRouter(prefix="/api/v1/research", tags=["research"])


def _build_state(
    body: ResearchRequest,
    *,
    credentials: HTTPAuthorizationCredentials,
    document_id: str | None = None,
) -> OrchestratorState:
    scope = ResearchScope.DOCUMENT if document_id or body.scope is ResearchScope.DOCUMENT else body.scope
    filters = body.search_filters()
    if document_id:
        filters = filters.model_copy(update={"document_id": document_id})
    return OrchestratorState(
        query=sanitize_user_input(body.query),
        jurisdiction_hint=body.jurisdiction,
        user_token=credentials.credentials,
        scope=scope,
        search_filters=filters,
        history=[
            ConversationMessage(
                role=turn.role,
                content=sanitize_user_input(turn.content),
            )
            for turn in body.history
        ],
    )


async def _run_research(state: OrchestratorState) -> ResearchResponse:
    injection = detect_prompt_injection(state.query)
    if injection.is_suspicious:
        raise ValidationFailedError(
            "The query was rejected by prompt-injection guardrails.",
            details=[{"matched_patterns": injection.matched_patterns}],
        )
    container = get_container()
    result = await container.orchestrator.run_state(state)
    return ResearchResponse(
        query=result.query,
        intent=result.intent,
        jurisdiction=result.jurisdiction,
        answer=result.answer,
        sources=result.sources,
        web_sources=result.web_sources,
        web_images=result.web_images,
        suggestions=result.suggestions,
        citations=result.citations,
        confidence=result.confidence,
        trace=result.trace,
        specialist_payload=result.specialist_payload,
    )


@router.post(
    "",
    response_model=ResearchResponse,
    summary="Run grounded legal research via the multi-agent orchestrator",
)
async def research(
    body: ResearchRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ResearchResponse:
    return await _run_research(_build_state(body, credentials=credentials))


@router.post(
    "/document/{document_id}",
    response_model=ResearchResponse,
    summary="Run research scoped to a single uploaded document",
)
async def research_document(
    document_id: uuid.UUID,
    body: ResearchRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ResearchResponse:
    return await _run_research(
        _build_state(body, credentials=credentials, document_id=str(document_id))
    )


@router.post(
    "/stream",
    summary="Stream grounded legal research (SSE tokens + final metadata)",
)
async def research_stream(
    body: ResearchRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StreamingResponse:
    state = _build_state(body, credentials=credentials)
    injection = detect_prompt_injection(state.query)
    if injection.is_suspicious:
        raise ValidationFailedError(
            "The query was rejected by prompt-injection guardrails.",
            details=[{"matched_patterns": injection.matched_patterns}],
        )

    container = get_container()

    async def generator() -> AsyncIterator[str]:
        async for chunk in container.orchestrator.run_state_streaming(state):
            yield chunk

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post(
    "/document/{document_id}/stream",
    summary="Stream research scoped to a single uploaded document",
)
async def research_document_stream(
    document_id: uuid.UUID,
    body: ResearchRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StreamingResponse:
    state = _build_state(body, credentials=credentials, document_id=str(document_id))
    injection = detect_prompt_injection(state.query)
    if injection.is_suspicious:
        raise ValidationFailedError(
            "The query was rejected by prompt-injection guardrails.",
            details=[{"matched_patterns": injection.matched_patterns}],
        )

    container = get_container()

    async def generator() -> AsyncIterator[str]:
        async for chunk in container.orchestrator.run_state_streaming(state):
            yield chunk

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _maybe_rewrite_for_speech(text: str, *, rewrite: bool, language: str) -> str:
    locale = get_speech_locale(language)
    if not rewrite:
        return text
    if len(text) <= 800 and locale.code == "en-IN":
        return text
    container = get_container()
    if isinstance(container.tts, StubTTSClient):
        return text
    script = await container.llm.complete(
        [
            ChatMessage(role="system", content=locale.rewrite_prompt),
            ChatMessage(role="user", content=text),
        ],
        temperature=0.3,
    )
    return script.strip() or text


def _frame_pcm(chunk: bytes) -> bytes:
    return struct.pack("<I", len(chunk)) + chunk


async def _tts_byte_stream(text: str, *, voice: str) -> AsyncIterator[bytes]:
    container = get_container()
    if isinstance(container.tts, StubTTSClient):
        raise RuntimeError("TTS unavailable in stub mode")

    chunks = prepare_speech_chunks(text)
    for sentence in chunks:
        async for pcm in container.tts.stream_speech(sentence, voice=voice):
            yield _frame_pcm(pcm)


@router.post(
    "/tts/stream",
    summary="Stream natural speech audio for a legal answer",
)
async def tts_stream(
    body: TtsRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> StreamingResponse:
    prepared = prepare_speech_text(body.text)
    if not prepared:
        raise ValidationFailedError("No speakable text after preprocessing.")

    container = get_container()
    if isinstance(container.tts, StubTTSClient):
        raise HTTPException(status_code=503, detail="TTS unavailable in stub mode")

    locale = get_speech_locale(body.language)
    speak_text = await _maybe_rewrite_for_speech(
        prepared, rewrite=body.rewrite_for_speech, language=body.language
    )

    async def generator() -> AsyncIterator[bytes]:
        async for framed in _tts_byte_stream(speak_text, voice=locale.voice):
            yield framed

    return StreamingResponse(
        generator(),
        media_type="application/octet-stream",
        headers={
            "X-Audio-Sample-Rate": str(container.tts.sample_rate),
            "X-Audio-Format": "pcm_s16le",
            "X-Audio-Channels": "1",
            "X-Speech-Locale": locale.code,
            "Cache-Control": "no-store",
        },
    )
