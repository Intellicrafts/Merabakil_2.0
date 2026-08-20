"""Research HTTP routes - runs the multi-agent orchestrator."""

from __future__ import annotations

import logging
import struct
import uuid
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials

from app.api.schemas import (
    CourtroomActionsRequest,
    CourtroomActionsResponse,
    CourtroomAgentTurnRequest,
    CourtroomAgentTurnResponse,
    CourtroomBlackboardEcho,
    CourtroomExhibitAction,
    CourtroomExtractedFact,
    CourtroomToolTraceItem,
    CourtroomTranscriptTurn,
    CourtroomTurnAgendaItem,
    CourtroomTurnExhibit,
    CourtroomTurnRequest,
    CourtroomTurnResponse,
    CourtroomVerifiedSource,
    ResearchRequest,
    ResearchResponse,
    TtsRequest,
)
from app.application.courtroom_actions import build_courtroom_actions
from app.application.courtroom_agents import run_agentic_hearing_turn
from app.application.courtroom_turn import build_courtroom_turn
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


def _build_state(
    body: ResearchRequest,
    *,
    credentials: HTTPAuthorizationCredentials,
    current_user: CurrentUser,
    document_id: str | None = None,
    server_history: list[ConversationMessage] | None = None,
    user_facts: list[str] | None = None,
) -> OrchestratorState:
    scope = ResearchScope.DOCUMENT if document_id or body.scope is ResearchScope.DOCUMENT else body.scope
    filters = body.search_filters()
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
    )


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
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
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
            server_history=history,
            user_facts=memory.long_term_facts,
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
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
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
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StreamingResponse:
    import asyncio
    import json as _json
    from legalos_orchestrator.agent.router import QueryRoute

    container = get_container()

    async def generator() -> AsyncIterator[str]:
        # HTTP 200 + first event reach browser in ~10ms — before any LLM or memory work
        yield "event: status\ndata: " + _json.dumps({"stage": "thinking", "message": "Understanding your question…"}) + "\n\n"

        route_result, memory_result = await asyncio.gather(
            container.router.classify(body.query),
            container.memory_manager.retrieve(body.session_id, current_user.user_id, body.query),
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

        state = _build_state(
            body,
            credentials=credentials,
            current_user=current_user,
            server_history=history,
            user_facts=user_facts,
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
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> StreamingResponse:
    import asyncio
    import json as _json
    from legalos_orchestrator.agent.router import QueryRoute

    container = get_container()

    async def generator() -> AsyncIterator[str]:
        yield "event: status\ndata: " + _json.dumps({"stage": "thinking", "message": "Understanding your question…"}) + "\n\n"

        route_result, memory_result = await asyncio.gather(
            container.router.classify(body.query),
            container.memory_manager.retrieve(body.session_id, current_user.user_id, body.query),
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

        state = _build_state(
            body,
            credentials=credentials,
            current_user=current_user,
            document_id=str(document_id),
            server_history=history,
            user_facts=user_facts,
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
    "/courtroom/actions",
    response_model=CourtroomActionsResponse,
    summary="Propose post-hearing counsel actions after an AI Courtroom simulation",
)
async def courtroom_actions(
    body: CourtroomActionsRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> CourtroomActionsResponse:
    container = get_container()
    return await build_courtroom_actions(container.llm, body)


@router.post(
    "/courtroom/turn",
    response_model=CourtroomTurnResponse,
    summary="Generate a grounded AI Courtroom hearing turn with verified sources",
)
async def courtroom_turn(
    body: CourtroomTurnRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CourtroomTurnResponse:
    container = get_container()
    return await build_courtroom_turn(
        container.llm,
        container.retriever,
        body,
        user_token=credentials.credentials,
    )


@router.post(
    "/courtroom/agent-turn",
    response_model=CourtroomAgentTurnResponse,
    summary="Agentic courtroom turn — CourtMaster grants floor; role agent uses tools",
)
async def courtroom_agent_turn(
    body: CourtroomAgentTurnRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CourtroomAgentTurnResponse:
    container = get_container()
    payload = body.model_dump(by_alias=False)
    # Also accept alias keys from frontend camelCase via model fields
    raw = await run_agentic_hearing_turn(
        container.llm,
        container.retriever,
        {
            **payload,
            "matter_title": body.matter_title,
            "matter_type": body.matter_type,
            "petitioner_name": body.petitioner_name,
            "respondent_name": body.respondent_name,
            "case_summary": body.case_summary,
            "relief_sought": body.relief_sought,
            "document_ids": body.document_ids,
            "persona_cues": body.persona_cues,
            "strategy_cues": body.strategy_cues,
            "turn_index": body.turn_index,
            "counsel_turns": body.counsel_turns,
            "judge_turns": body.judge_turns,
            "closings_done": body.closings_done,
            "issues_framed": body.issues_framed,
            "verdict_ready": body.verdict_ready,
            "last_speaker": body.last_speaker,
            "derived_phase": body.derived_phase,
            "force_end": body.force_end,
            "force_speaker": body.force_speaker,
            "agenda": [a.model_dump() for a in body.agenda],
            "exhibits": [e.model_dump() for e in body.exhibits],
            "authorities": [
                a.model_dump(by_alias=True) for a in body.authorities
            ],
            "transcript_excerpt": body.transcript_excerpt,
            "transcript_turns": [t.model_dump() for t in body.transcript_turns],
            "facts": body.facts,
            "issues": body.issues,
            "jurisdiction": body.jurisdiction,
            "compressed_case": body.compressed_case,
            "extracted_facts": [f.model_dump() for f in body.extracted_facts],
            "running_memory": body.running_memory,
            "scratchpads": body.scratchpads,
        },
        user_token=credentials.credentials,
    )

    bb = raw.get("blackboard") or {}
    return CourtroomAgentTurnResponse(
        speaker=raw["speaker"],
        text=raw["text"],
        textHi=raw.get("textHi"),
        addressesPointIds=raw.get("addressesPointIds") or [],
        citeSourceIds=raw.get("citeSourceIds") or [],
        exhibitActions=[
            CourtroomExhibitAction(exhibitId=a["exhibitId"], status=a["status"])
            for a in (raw.get("exhibitActions") or [])
            if a.get("exhibitId")
        ],
        timelineStep=raw.get("timelineStep"),
        judgeState=raw.get("judgeState"),
        judgeNote=raw.get("judgeNote"),
        isVerdict=bool(raw.get("isVerdict")),
        toolTrace=[
            CourtroomToolTraceItem(
                tool=str(t.get("tool") or ""),
                args=t.get("args") if isinstance(t.get("args"), dict) else {},
                result=t.get("result") if isinstance(t.get("result"), dict) else {},
            )
            for t in (raw.get("toolTrace") or [])
        ],
        verifiedSources=[
            CourtroomVerifiedSource(
                id=str(s.get("id") or ""),
                title=str(s.get("title") or ""),
                citation=str(s.get("citation") or ""),
                snippet=str(s.get("snippet") or ""),
                sourceKind=str(s.get("sourceKind") or "corpus"),
                url=s.get("url"),
                documentId=s.get("documentId"),
                verified=s.get("verified", True),
            )
            for s in (raw.get("verifiedSources") or [])
            if s.get("id")
        ],
        blackboard=CourtroomBlackboardEcho(
            turnIndex=int(bb.get("turnIndex") or 0),
            counselTurns=int(bb.get("counselTurns") or 0),
            judgeTurns=int(bb.get("judgeTurns") or 0),
            closingsDone=int(bb.get("closingsDone") or 0),
            issuesFramed=bool(bb.get("issuesFramed")),
            verdictReady=bool(bb.get("verdictReady")),
            lastSpeaker=bb.get("lastSpeaker"),
            derivedPhase=str(bb.get("derivedPhase") or "submissions"),
            agenda=[
                CourtroomTurnAgendaItem(**a) for a in (bb.get("agenda") or [])
            ],
            exhibits=[
                CourtroomTurnExhibit(**e) for e in (bb.get("exhibits") or [])
            ],
            authorities=[
                CourtroomVerifiedSource(
                    id=str(s.get("id") or ""),
                    title=str(s.get("title") or ""),
                    citation=str(s.get("citation") or ""),
                    snippet=str(s.get("snippet") or ""),
                    sourceKind=str(s.get("sourceKind") or "corpus"),
                    url=s.get("url"),
                    documentId=s.get("documentId"),
                    verified=s.get("verified", True),
                )
                for s in (bb.get("authorities") or [])
                if s.get("id")
            ],
            compressedCase=bb.get("compressedCase") or bb.get("compressed_case"),
            extractedFacts=[
                CourtroomExtractedFact(
                    id=str(f.get("id") or ""),
                    text=str(f.get("text") or ""),
                    side=str(f.get("side") or "neutral"),
                    status=str(f.get("status") or "asserted"),
                    source=str(f.get("source") or "intake"),
                )
                for f in (bb.get("extractedFacts") or bb.get("extracted_facts") or [])
                if isinstance(f, dict) and f.get("text")
            ],
            runningMemory=bb.get("runningMemory") or bb.get("running_memory"),
            scratchpads=dict(bb.get("scratchpads") or {}),
            transcriptTurns=[
                CourtroomTranscriptTurn(role=str(t.get("role") or ""), text=str(t.get("text") or ""))
                for t in (bb.get("transcriptTurns") or bb.get("transcript_turns") or [])
                if isinstance(t, dict) and t.get("role") and t.get("text")
            ],
        ),
        disclaimer=str(raw.get("disclaimer") or ""),
    )


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
