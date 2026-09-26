"""One streaming pipeline for every Saarthi chat endpoint (member, guest, document).

SSE contract sent to the browser:
  status {stage, message}        — progress, any number
  token {text}                   — answer text, any number
  draft_status {status}          — a document draft is being generated (members)
  draft {title, document_type, content} — sent BEFORE done when a draft was requested
  citations / done {…, mode}     — the answer completed (terminal)
  error {code, message}          — no answer (terminal); nothing is billed or saved
  ": ping" comments              — keepalive every 15s while the model is working

Exactly one terminal event (done or error) is always sent.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator
from contextlib import suppress
from dataclasses import dataclass
from decimal import Decimal

from app.api.schemas import ResearchRequest
from app.config import get_settings
from app.infrastructure.billing_client import BillingClient
from app.infrastructure.container import get_container
from legalos_common.rag.guardrails import InputGuardrail, sanitize_user_input, strip_citation_markers
from legalos_common.security.rbac import CurrentUser
from legalos_orchestrator.agent.router import QueryRoute
from legalos_orchestrator.agent.tools.lawyer_tool import lawyer_line
from legalos_orchestrator.schemas import ConversationMessage, OrchestratorState, ResearchScope

logger = logging.getLogger(__name__)

_settings = get_settings()
billing = BillingClient(_settings.billing_service_url, _settings.billing_internal_secret)
CHATBOT_FEE = Decimal(_settings.chatbot_query_fee_inr)

MAX_TURN_CHARS = 4000
GUEST_CLIENT_HISTORY_TURNS = 10
KEEPALIVE_SECONDS = 15.0
DRAFT_TIMEOUT_SECONDS = 90.0

_input_guardrail = InputGuardrail()

# Strong references to fire-and-forget work so it isn't garbage-collected mid-flight.
_BACKGROUND: set[asyncio.Task] = set()


def spawn(coro) -> None:
    task = asyncio.create_task(coro)
    _BACKGROUND.add(task)
    task.add_done_callback(_BACKGROUND.discard)


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


# User-facing copy for terminal errors. Internal details never reach the client.
ERROR_MESSAGES = {
    "rejected": "I can't process that message. Please rephrase your question.",
    "insufficient_balance": "Your wallet balance is too low to continue. Please add balance to keep chatting.",
    "ai_unavailable": "Saarthi is temporarily unavailable. Please try again in a moment.",
    "interrupted": "The answer was interrupted. Please try again.",
    "server_error": "Something went wrong on our side. Please try again.",
}


def error_event(code: str) -> str:
    return sse("error", {"code": code, "message": ERROR_MESSAGES.get(code, ERROR_MESSAGES["server_error"])})


def primary_role(user: CurrentUser | None) -> str:
    if user is None:
        return "citizen"
    roles = set(user.roles or [])
    for role in ("advocate", "law_firm", "enterprise", "admin"):
        if role in roles:
            return role
    return "citizen"


def scoped_session_id(session_id: str | None, *, user_id: str | None, is_guest: bool) -> str | None:
    """Namespace client session ids by owner so one user can never read or write
    another user's (or a guest's) conversation memory by guessing its id."""
    if not session_id:
        return None
    sid = session_id.strip()[:100]
    if is_guest or not user_id:
        return f"g:{sid}"
    return f"u:{user_id}:{sid}"


def history_from_turns(turns) -> list[ConversationMessage]:
    out: list[ConversationMessage] = []
    for t in turns:
        content = strip_citation_markers(sanitize_user_input(t.content or "")).strip()
        if not content or t.role not in ("user", "assistant"):
            continue
        if len(content) > MAX_TURN_CHARS:
            content = content[: MAX_TURN_CHARS - 1] + "…"
        out.append(ConversationMessage(role=t.role, content=content))
    return out


def _stored_assistant_text(answer: str, lawyers: list[dict] | None) -> str:
    text = strip_citation_markers(answer).strip()
    if lawyers:
        # Keep the booking ids in memory so "book the second one" works next turn.
        shown = "\n".join(lawyer_line(i, l) for i, l in enumerate(lawyers, 1))
        text = f"{text}\n\n[Lawyers shown to the user]\n{shown}"
    return text


@dataclass
class ChatRequest:
    body: ResearchRequest
    token: str  # bearer used for downstream calls (member JWT or guest scoped token)
    user: CurrentUser | None
    is_guest: bool
    document_id: str | None = None


async def _resolve_documents(req: ChatRequest, sid: str | None, query: str) -> tuple[list[str], str]:
    """Documents in play for this turn and the prompt text drawn from them.

    Uploads are read through the per-user temporary index (doc_index.py): short
    files whole, long files as their opening plus the passages relevant to this
    question. They are never searched through the shared knowledge base."""
    if req.is_guest or req.user is None:
        return [], ""
    container = get_container()
    ids: list[str] = []
    if sid:
        with suppress(Exception):
            ids = await container.session_documents.get(sid)
    for doc_id in [*(req.body.document_ids or []), *([req.document_id] if req.document_id else [])]:
        if doc_id and doc_id not in ids:
            ids.append(doc_id)
    if not ids:
        return [], ""
    try:
        text = await container.doc_context.context_for(
            owner=req.user.user_id, document_ids=ids, query=query, user_token=req.token
        )
    except Exception as exc:
        logger.warning("session_document_context_failed error=%s", type(exc).__name__)
        text = ""
    return ids, text


async def _chat_events(req: ChatRequest) -> AsyncIterator[str]:
    container = get_container()
    body = req.body
    user_id = None if req.is_guest or req.user is None else req.user.user_id
    sid = scoped_session_id(body.session_id, user_id=user_id, is_guest=req.is_guest)
    billable = bool(user_id) and CHATBOT_FEE > 0

    yield sse("status", {"stage": "thinking", "message": "Understanding your question…"})

    query = sanitize_user_input(body.query)
    if not _input_guardrail.validate(query).passed:
        yield error_event("rejected")
        return

    if billable and not await billing.has_balance(user_token=req.token, minimum=CHATBOT_FEE):
        yield error_event("insufficient_balance")
        return

    quick = container.router.quick_classify(query)
    if quick == QueryRoute.CONVERSATIONAL:
        memory = await container.memory_manager.retrieve_session_only(sid)
        route = QueryRoute.CONVERSATIONAL
    else:
        route_result, memory = await asyncio.gather(
            container.router.classify(query),
            container.memory_manager.retrieve(sid, user_id, query),
            return_exceptions=True,
        )
        route = route_result if isinstance(route_result, QueryRoute) else QueryRoute.LEGAL
        if isinstance(memory, Exception):
            memory = await container.memory_manager.retrieve_session_only(sid)

    history = history_from_turns(memory.session_history)
    if not history and body.history:
        # First turn after a server restart / expiry: fall back to the client copy.
        client_turns = body.history[-GUEST_CLIENT_HISTORY_TURNS:] if req.is_guest else body.history
        history = history_from_turns(client_turns)

    doc_ids, doc_text = await _resolve_documents(req, sid, query)
    if doc_text and route == QueryRoute.CONVERSATIONAL:
        route = QueryRoute.LEGAL

    # Knowledge-base search is over curated law only — never scoped to user files.
    filters = body.search_filters().model_copy(update={"document_id": None, "document_ids": None})
    if req.is_guest:
        filters = filters.model_copy(update={"doc_type": None})

    state = OrchestratorState(
        query=query,
        jurisdiction_hint=body.jurisdiction,
        user_token=req.token,
        session_id=sid,
        user_id=user_id,
        is_guest=req.is_guest,
        user_role=primary_role(req.user),
        scope=ResearchScope.DOCUMENT if req.document_id else body.scope,
        search_filters=filters,
        history=history,
        user_facts=memory.long_term_facts if user_id else [],
        session_document_ids=doc_ids,
        session_document_text=doc_text,
        route=route,
    )

    draft_task: asyncio.Task | None = None
    if not req.is_guest:
        from app.infrastructure.draft_detector import detect_draft_intent
        from app.infrastructure.draft_generator import generate_draft

        is_draft, doc_type = detect_draft_intent(query)
        if is_draft:
            draft_task = asyncio.create_task(
                generate_draft(
                    query,
                    doc_type,
                    [{"role": m.role, "content": m.content} for m in history],
                    container.llm,
                )
            )
            yield sse("draft_status", {"status": "generating"})

    done_payload: dict | None = None
    try:
        async for chunk in container.orchestrator.run_state_streaming(state):
            if chunk.startswith("event: done"):
                done_payload = json.loads(chunk.split("data: ", 1)[1])
                if draft_task is not None:
                    try:
                        draft = await asyncio.wait_for(draft_task, timeout=DRAFT_TIMEOUT_SECONDS)
                    except Exception:
                        draft = None
                    draft_task = None
                    if draft:
                        yield sse("draft", draft)
            yield chunk
    finally:
        if draft_task is not None and not draft_task.done():
            draft_task.cancel()

    if not done_payload:
        return  # orchestrator already sent a terminal error; bill and save nothing

    answer = done_payload.get("answer") or ""
    mode = done_payload.get("mode")
    lawyers = (done_payload.get("specialist_payload") or {}).get("lawyers")
    if answer and sid:
        spawn(
            container.memory_manager.persist(
                session_id=sid,
                user_id=user_id,
                user_content=query,
                assistant_content=_stored_assistant_text(answer, lawyers),
            )
        )
    if answer and billable and mode == "agent":
        spawn(billing.deduct_chatbot_query(user_id=user_id, fee=CHATBOT_FEE, session_id=body.session_id))


async def chat_stream(req: ChatRequest) -> AsyncIterator[str]:
    """``_chat_events`` plus keepalive pings, a guaranteed terminal event and
    cleanup of the model run when the client disconnects."""
    queue: asyncio.Queue[tuple[str, str | None]] = asyncio.Queue()
    terminal = False

    async def pump() -> None:
        try:
            async for item in _chat_events(req):
                await queue.put(("item", item))
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("chat_stream_failed")
            await queue.put(("fail", None))
        finally:
            await queue.put(("end", None))

    task = asyncio.create_task(pump())
    try:
        while True:
            try:
                kind, item = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SECONDS)
            except asyncio.TimeoutError:
                yield ": ping\n\n"
                continue
            if kind == "item":
                if item.startswith(("event: done", "event: error")):
                    terminal = True
                yield item
            elif kind == "fail":
                if not terminal:
                    terminal = True
                    yield error_event("server_error")
            else:
                if not terminal:
                    yield error_event("server_error")
                return
    finally:
        # Client gone (or finished): stop the model run and any draft generation.
        if not task.done():
            task.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await task


SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}
