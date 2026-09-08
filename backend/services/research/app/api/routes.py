"""Research HTTP routes - runs the multi-agent orchestrator."""

from __future__ import annotations

import logging
import struct
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel

from app.api.schemas import (
    ResearchRequest,
    ResearchResponse,
    TtsRequest,
)
from app.api.deps import (
    chat_rate_limit,
    tts_rate_limit,
)
from app.infrastructure.container import get_container
from legalos_common.api.errors import ValidationFailedError
from legalos_common.clients.llm import ChatMessage
from legalos_common.clients.tts import StubTTSClient
from legalos_common.rag.guardrails import InputGuardrail, detect_prompt_injection, sanitize_user_input
from legalos_common.security.rbac import (
    CurrentUser,
    Permission,
    bearer_scheme,
    get_current_user,
    require_permissions,
)
from legalos_common.speech.locales import get_speech_locale
from legalos_common.speech.prepare import prepare_speech_chunks, prepare_speech_text
from legalos_orchestrator.schemas import ConversationMessage, OrchestratorState, ResearchScope

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/research", tags=["research"])

from decimal import Decimal as _Decimal  # noqa: E402
from app.config import get_settings as _get_settings  # noqa: E402
from app.infrastructure.billing_client import BillingClient as _BillingClient  # noqa: E402

_research_settings = _get_settings()
_billing = _BillingClient(
    _research_settings.billing_service_url,
    _research_settings.billing_internal_secret,
)
_CHATBOT_FEE = _Decimal(_research_settings.chatbot_query_fee_inr)


def _merge_doc_ids(*groups: list[str] | None) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for group in groups:
        for item in group or []:
            if item and item not in seen:
                seen.add(item)
                out.append(item)
    return out


def _build_state(
    body: ResearchRequest,
    *,
    credentials: HTTPAuthorizationCredentials,
    current_user: CurrentUser,
    document_id: str | None = None,
    server_history: list[ConversationMessage] | None = None,
    user_facts: list[str] | None = None,
    session_document_ids: list[str] | None = None,
    session_document_text: str = "",
) -> OrchestratorState:
    scope = ResearchScope.DOCUMENT if document_id or body.scope is ResearchScope.DOCUMENT else body.scope
    # Session attachments must not become exclusive Qdrant filters — those docs
    # may only exist as extracted text until ingestion finishes.
    filters = body.search_filters().model_copy(update={"document_ids": None})
    if document_id:
        filters = filters.model_copy(update={"document_id": document_id})

    # Server history takes priority; fall back to client-sent history
    history = server_history if server_history is not None else [
        ConversationMessage(role=turn.role, content=sanitize_user_input(turn.content))
        for turn in body.history
    ]

    return OrchestratorState(
        query=sanitize_user_input(body.query),
        jurisdiction_hint=body.jurisdiction,
        user_token=credentials.credentials,
        session_id=body.session_id,
        user_id=current_user.user_id,
        scope=scope,
        search_filters=filters,
        history=history,
        user_facts=user_facts or [],
        session_document_ids=session_document_ids or [],
        session_document_text=session_document_text,
    )


async def _resolve_session_documents(
    body: ResearchRequest,
    credentials: HTTPAuthorizationCredentials,
) -> tuple[list[str], str]:
    container = get_container()
    redis_ids: list[str] = []
    if body.session_id:
        try:
            redis_ids = await container.session_documents.get(body.session_id)
        except Exception:
            redis_ids = []
    doc_ids = _merge_doc_ids(redis_ids, body.document_ids)
    if not doc_ids:
        return [], ""

    cache_key = "research:doctext:" + ",".join(sorted(doc_ids))
    if container.redis:
        try:
            cached = await container.redis.get(cache_key)
            if cached:
                text = cached.decode() if isinstance(cached, bytes) else cached
                return doc_ids, text
        except Exception:
            pass

    excerpt = ""
    try:
        excerpt = await container.document_texts.fetch_excerpts(
            doc_ids, user_token=credentials.credentials
        )
    except Exception as exc:
        logger.warning("session_document_text_failed error=%s", exc)

    if excerpt and container.redis:
        try:
            await container.redis.set(cache_key, excerpt, ex=7200)
        except Exception:
            pass

    return doc_ids, excerpt


_input_guardrail = InputGuardrail()


async def _run_research(state: OrchestratorState) -> ResearchResponse:
    guard = _input_guardrail.validate(state.query)
    if not guard.passed:
        raise ValidationFailedError(
            "The query was rejected by guardrails.",
            details=[{"reason": guard.reason}],
        )
    container = get_container()
    result = await container.orchestrator.run_state(state)

    # Persist memory after non-streaming response
    if state.session_id or state.user_id:
        import asyncio
        asyncio.create_task(
            container.memory_manager.persist(
                session_id=state.session_id,
                user_id=state.user_id,
                user_content=state.query,
                assistant_content=result.answer,
                cited_chunk_ids=[c.document_id for c in result.citations],
            )
        )

    if state.user_id and _CHATBOT_FEE > _Decimal("0"):
        import asyncio
        asyncio.create_task(
            _billing.deduct_chatbot_query(user_id=state.user_id, fee=_CHATBOT_FEE)
        )

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
    current_user: CurrentUser = Depends(chat_rate_limit),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ResearchResponse:
    container = get_container()
    memory = await container.memory_manager.retrieve(body.session_id, current_user.user_id, body.query)
    history = [
        ConversationMessage(role=t.role, content=t.content)
        for t in memory.session_history
    ] or None
    session_doc_ids, session_doc_text = await _resolve_session_documents(body, credentials)
    return await _run_research(
        _build_state(
            body,
            credentials=credentials,
            current_user=current_user,
            server_history=history,
            user_facts=memory.long_term_facts,
            session_document_ids=session_doc_ids,
            session_document_text=session_doc_text,
        )
    )


@router.post(
    "/document/{document_id}",
    response_model=ResearchResponse,
    summary="Run research scoped to a single uploaded document",
)
async def research_document(
    document_id: uuid.UUID,
    body: ResearchRequest,
    current_user: CurrentUser = Depends(chat_rate_limit),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> ResearchResponse:
    container = get_container()
    memory = await container.memory_manager.retrieve(body.session_id, current_user.user_id, body.query)
    history = [
        ConversationMessage(role=t.role, content=t.content)
        for t in memory.session_history
    ] or None
    return await _run_research(
        _build_state(
            body,
            credentials=credentials,
            current_user=current_user,
            document_id=str(document_id),
            server_history=history,
            user_facts=memory.long_term_facts,
        )
    )


@router.post(
    "/stream",
    summary="Stream grounded legal research (SSE tokens + final metadata)",
)
async def research_stream(
    body: ResearchRequest,
    current_user: CurrentUser = Depends(chat_rate_limit),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StreamingResponse:
    import asyncio
    import json as _json
    from legalos_orchestrator.agent.router import QueryRoute

    container = get_container()

    async def generator() -> AsyncIterator[str]:
        # HTTP 200 + first event reach browser in ~10ms — before any LLM or memory work
        yield "event: status\ndata: " + _json.dumps({"stage": "thinking", "message": "Understanding your question…"}) + "\n\n"

        route_result, memory_result, doc_result = await asyncio.gather(
            container.router.classify(body.query),
            container.memory_manager.retrieve(body.session_id, current_user.user_id, body.query),
            _resolve_session_documents(body, credentials),
            return_exceptions=True,
        )
        route = route_result if isinstance(route_result, QueryRoute) else QueryRoute.LEGAL

        if route == QueryRoute.CONVERSATIONAL or isinstance(memory_result, Exception):
            history = None
            user_facts: list[str] = []
        else:
            history = [
                ConversationMessage(role=t.role, content=t.content)
                for t in memory_result.session_history
            ] or None
            user_facts = memory_result.long_term_facts

        if isinstance(doc_result, Exception) or doc_result is None:
            session_doc_ids, session_doc_text = [], ""
        else:
            session_doc_ids, session_doc_text = doc_result

        if session_doc_text and route == QueryRoute.CONVERSATIONAL:
            route = QueryRoute.LEGAL

        state = _build_state(
            body,
            credentials=credentials,
            current_user=current_user,
            server_history=history,
            user_facts=user_facts,
            session_document_ids=session_doc_ids,
            session_document_text=session_doc_text,
        )
        state = state.model_copy(update={"route": route})

        guard = _input_guardrail.validate(state.query)
        if not guard.passed:
            yield "event: error\ndata: " + _json.dumps({"message": "Query rejected — please rephrase."}) + "\n\n"
            return

        answer = ""
        async for chunk in container.orchestrator.run_state_streaming(state):
            if chunk.startswith("event: done"):
                try:
                    data_line = chunk.split("data: ", 1)[1].strip()
                    answer = _json.loads(data_line).get("answer", "")
                except Exception:
                    pass
            yield chunk

        if answer and (state.session_id or state.user_id):
            asyncio.create_task(
                container.memory_manager.persist(
                    session_id=state.session_id,
                    user_id=state.user_id,
                    user_content=state.query,
                    assistant_content=answer,
                )
            )

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
    current_user: CurrentUser = Depends(chat_rate_limit),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StreamingResponse:
    import asyncio
    import json as _json
    from legalos_orchestrator.agent.router import QueryRoute

    container = get_container()

    async def generator() -> AsyncIterator[str]:
        yield "event: status\ndata: " + _json.dumps({"stage": "thinking", "message": "Understanding your question…"}) + "\n\n"

        route_result, memory_result, doc_result = await asyncio.gather(
            container.router.classify(body.query),
            container.memory_manager.retrieve(body.session_id, current_user.user_id, body.query),
            _resolve_session_documents(body, credentials),
            return_exceptions=True,
        )
        route = route_result if isinstance(route_result, QueryRoute) else QueryRoute.LEGAL

        if route == QueryRoute.CONVERSATIONAL or isinstance(memory_result, Exception):
            history = None
            user_facts: list[str] = []
        else:
            history = [
                ConversationMessage(role=t.role, content=t.content)
                for t in memory_result.session_history
            ] or None
            user_facts = memory_result.long_term_facts

        if isinstance(doc_result, Exception) or doc_result is None:
            session_doc_ids, session_doc_text = [], ""
        else:
            session_doc_ids, session_doc_text = doc_result

        if session_doc_text and route == QueryRoute.CONVERSATIONAL:
            route = QueryRoute.LEGAL
        scoped_ids = _merge_doc_ids(session_doc_ids, [str(document_id)])
        if str(document_id) not in (body.document_ids or []):
            extra = await container.document_texts.fetch_excerpts(
                [str(document_id)], user_token=credentials.credentials
            )
            if extra:
                session_doc_text = f"{session_doc_text}\n\n{extra}".strip()
        state = _build_state(
            body,
            credentials=credentials,
            current_user=current_user,
            document_id=str(document_id),
            server_history=history,
            user_facts=user_facts,
            session_document_ids=scoped_ids,
            session_document_text=session_doc_text,
        )
        state = state.model_copy(update={"route": route})

        guard = _input_guardrail.validate(state.query)
        if not guard.passed:
            yield "event: error\ndata: " + _json.dumps({"message": "Query rejected — please rephrase."}) + "\n\n"
            return

        answer = ""
        async for chunk in container.orchestrator.run_state_streaming(state):
            if chunk.startswith("event: done"):
                try:
                    data_line = chunk.split("data: ", 1)[1].strip()
                    answer = _json.loads(data_line).get("answer", "")
                except Exception:
                    pass
            yield chunk

        if answer and (state.session_id or state.user_id):
            asyncio.create_task(
                container.memory_manager.persist(
                    session_id=state.session_id,
                    user_id=state.user_id,
                    user_content=state.query,
                    assistant_content=answer,
                )
            )

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


class _AttachDocumentRequest(BaseModel):
    document_id: str


@router.post(
    "/sessions/{session_id}/documents",
    summary="Attach an uploaded document to a Saarthi session (adds to LLM context)",
)
async def attach_session_document(
    session_id: str,
    body: _AttachDocumentRequest,
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> dict:
    container = get_container()
    await container.session_documents.attach(session_id, body.document_id)
    doc_ids = await container.session_documents.get(session_id)
    return {"session_id": session_id, "document_ids": doc_ids}


@router.get(
    "/sessions/{session_id}/documents",
    summary="List documents attached to a Saarthi session",
)
async def get_session_documents(
    session_id: str,
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> dict:
    container = get_container()
    doc_ids = await container.session_documents.get(session_id)
    return {"session_id": session_id, "document_ids": doc_ids}


@router.delete(
    "/sessions/{session_id}/documents/{document_id}",
    status_code=204,
    summary="Remove a document from a Saarthi session's context",
)
async def detach_session_document(
    session_id: str,
    document_id: str,
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> None:
    container = get_container()
    await container.session_documents.remove(session_id, document_id)


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


async def _collect_sentence(tts, sentence: str, voice: str) -> list[bytes]:
    """Collect all framed PCM for one sentence — used for background prefetch."""
    frames: list[bytes] = []
    try:
        async for pcm in tts.stream_speech(sentence, voice=voice):
            frames.append(_frame_pcm(pcm))
    except Exception as exc:
        logger.warning("tts_chunk_error sentence=%r error=%s", sentence[:40], exc)
    return frames


async def _tts_byte_stream(text: str, *, voice: str) -> AsyncIterator[bytes]:
    import asyncio

    container = get_container()
    if isinstance(container.tts, StubTTSClient):
        raise RuntimeError("TTS unavailable in stub mode")

    chunks = prepare_speech_chunks(text)
    if not chunks:
        return

    # Kick off background synthesis for sentences 2+ immediately so they are
    # ready (or nearly ready) by the time sentence 1 finishes playing.
    prefetch = [
        asyncio.create_task(_collect_sentence(container.tts, s, voice=voice))
        for s in chunks[1:]
    ]

    # Stream sentence 1 directly — first audio reaches the browser fastest.
    try:
        async for pcm in container.tts.stream_speech(chunks[0], voice=voice):
            yield _frame_pcm(pcm)
    except Exception as exc:
        logger.warning("tts_chunk_error sentence=%r error=%s", chunks[0][:40], exc)

    # Yield remaining sentences in order as each background task completes.
    for task in prefetch:
        for framed in await task:
            yield framed
            # continue with remaining chunks rather than aborting the whole stream



@router.post(
    "/tts/stream",
    summary="Stream natural speech audio for a legal answer",
)
async def tts_stream(
    body: TtsRequest,
    _: CurrentUser = Depends(tts_rate_limit),
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
