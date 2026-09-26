"""Gemini Multimodal Live API — bidirectional WebSocket proxy with tool calling.

Architecture:
  Browser (mic PCM 16kHz) ──ws──► [this endpoint] ──ws──► Gemini Live
  Browser (audio playback) ◄──ws── [this endpoint] ◄──ws── Gemini Live
                                         ▲
                                   tool calls:
                                   legal_search     → container.retriever (user's token)
                                   web_search       → search_web_text()
                                   find_lawyers     → marketplace (members)
                                   book_appointment → marketplace (citizens, fee confirmed)

Browser → server: {"type":"context","messages":[…],"session_id":"…"} within 3s of
"ready"; binary 16 kHz PCM; {"type":"interrupt"}.
Server → browser: ready, state, transcript, interrupted, lawyer_results,
appointment_booked, error, guest_ended; binary 24 kHz PCM.
Close codes: 4001 bad/used token, 4029 rate limited, 4090 guest time cap,
4402 insufficient balance, 4408 member session cap.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import ssl
from contextlib import suppress

import certifi
import httpx
import websockets
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.api.chat_pipeline import (
    CHATBOT_FEE,
    billing,
    primary_role,
    scoped_session_id,
    spawn,
)
from app.infrastructure.container import get_container
from legalos_common.clients.web_search import search_web_text
from legalos_common.rag.guardrails import sanitize_user_input
from legalos_common.security.jwt import TokenType, decode_token
from legalos_common.security.rate_limit import check_rate_limit
from legalos_common.security.rbac import GUEST_ROLE, CurrentUser
from legalos_orchestrator.agent.tools.lawyer_tool import format_fee
from legalos_orchestrator.prompts import build_voice_system_prompt, today_ist

_SSL_CTX = ssl.create_default_context(cafile=certifi.where())

logger = logging.getLogger(__name__)
voice_router = APIRouter(prefix="/api/v1/research", tags=["voice"])

_GEMINI_LIVE_WS = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
)

GUEST_SESSION_SECONDS = 95  # backstop to the 90s client timer
MEMBER_SESSION_SECONDS = 15 * 60
_CONTEXT_TURNS = 10
_CONTEXT_CHARS = 600

_LEGAL_SEARCH = {
    "name": "legal_search",
    "description": (
        "Search the verified Indian legal knowledge base — Constitution, BNS/BNSS/BSA, "
        "IPC/CrPC, civil and special statutes, case law. Use for any legal question that "
        "needs an accurate section, procedure or citation. Query in English."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Specific legal question or topic, in English."},
            "top_k": {"type": "integer", "description": "Number of results (1–12, default 6)."},
        },
        "required": ["query"],
    },
}
_WEB_SEARCH = {
    "name": "web_search",
    "description": (
        "Search the web for recent Indian legal developments (2024 onwards) or when the "
        "knowledge base has nothing relevant. Never use it to find lawyers."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Search query."},
            "num_results": {"type": "integer", "description": "Number of results (1–5, default 3)."},
        },
        "required": ["query"],
    },
}
_FIND_LAWYERS = {
    "name": "find_lawyers",
    "description": (
        "Find verified lawyers on MeraBakil for the user's matter. Only when the matter "
        "needs professional representation or the user asks for a lawyer."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "practice_areas": {
                "type": "string",
                "description": "Comma-separated practice areas, e.g. 'Criminal Law,Bail'.",
            },
            "jurisdictions": {
                "type": "string",
                "description": "Comma-separated states or cities; empty if unknown.",
            },
            "limit": {"type": "integer", "description": "Number of lawyers (1–5, default 3)."},
        },
        "required": ["practice_areas"],
    },
}
_BOOK_APPOINTMENT = {
    "name": "book_appointment",
    "description": (
        "Book a paid consultation with a lawyer returned by find_lawyers. Only after you "
        "told the user the lawyer's name, the date and time slot and the fee, and they "
        "explicitly agreed to that booking."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "lawyer_id": {"type": "string", "description": "The booking_id UUID from find_lawyers, copied exactly."},
            "date": {"type": "string", "description": "YYYY-MM-DD (today's date is in the session context)."},
            "time_slot": {
                "type": "string",
                "description": "'Immediate' only if the user asked for right now, else e.g. '10:00 AM'.",
            },
            "matter_summary": {"type": "string", "description": "One-sentence summary of the matter (min 10 chars)."},
            "user_confirmed_fee": {
                "type": "boolean",
                "description": "True only if the user explicitly agreed to this lawyer, slot and the fee you stated.",
            },
            "citizen_name": {"type": "string", "description": "User's name if they said it, else empty."},
        },
        "required": ["lawyer_id", "date", "time_slot", "matter_summary", "user_confirmed_fee"],
    },
}


def _tools_for(*, is_guest: bool, role: str) -> list[dict]:
    if is_guest:
        return [_LEGAL_SEARCH, _WEB_SEARCH]
    if role != "citizen":
        return [_LEGAL_SEARCH, _WEB_SEARCH, _FIND_LAWYERS]
    return [_LEGAL_SEARCH, _WEB_SEARCH, _FIND_LAWYERS, _BOOK_APPOINTMENT]


def _setup_msg(*, voice: str, model: str, is_guest: bool, role: str) -> dict:
    return {
        "setup": {
            "model": f"models/{model}",
            "generation_config": {
                "response_modalities": ["AUDIO"],
                "speech_config": {"voice_config": {"prebuilt_voice_config": {"voice_name": voice}}},
            },
            # Transcription fields must be at setup level, NOT inside generation_config
            "input_audio_transcription": {},
            "output_audio_transcription": {},
            "system_instruction": {
                "parts": [{"text": build_voice_system_prompt(
                    is_guest=is_guest, is_advocate=role in ("advocate", "law_firm")
                )}]
            },
            "tools": [{"function_declarations": _tools_for(is_guest=is_guest, role=role)}],
        }
    }


def _context_turns(messages: list) -> list[dict]:
    """Prior text-chat turns as ordinary conversation turns (never system text)."""
    turns: list[dict] = []
    for m in messages[-_CONTEXT_TURNS:]:
        if not isinstance(m, dict):
            continue
        role = "user" if m.get("role") == "user" else "model"
        text = sanitize_user_input(str(m.get("content") or ""))[:_CONTEXT_CHARS].strip()
        if text:
            turns.append({"role": role, "parts": [{"text": text}]})
    return turns


async def _run_legal_search(query: str, top_k: int, token: str) -> str:
    container = get_container()
    try:
        results = await container.retriever.retrieve(
            query, top_k=min(max(1, top_k), 12), filters=None, user_token=token
        )
    except Exception as exc:
        logger.warning("voice_legal_search_error error=%s", type(exc).__name__)
        return "The legal knowledge base is unavailable right now. Answer carefully from general knowledge."
    if not results:
        return "No relevant documents found in the Indian legal knowledge base for this query."
    parts: list[str] = []
    for src in results:
        header = " | ".join(x for x in (src.title, src.citation, src.section) if x)
        parts.append(f"{header}\n{(src.content or '')[:600]}")
    return "\n\n---\n\n".join(parts)


async def _run_web_search(query: str, num_results: int, tavily_key: str) -> str:
    try:
        results = await search_web_text(
            f"{query} India law", max_results=min(max(1, num_results), 5), tavily_api_key=tavily_key
        )
    except Exception as exc:
        logger.warning("voice_web_search_error error=%s", type(exc).__name__)
        return "Web search is currently unavailable."
    if not results:
        return "No relevant web results found."
    return "\n\n---\n\n".join(f"{r.title}\n{(r.snippet or '')[:400]}" for r in results)


def _parse_csv(value: str) -> list[str]:
    return [v.strip() for v in (value or "").split(",") if v.strip()]


async def _run_find_lawyers(
    practice_areas: list[str], jurisdictions: list[str], limit: int, marketplace_url: str
) -> tuple[str, list[dict]]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{marketplace_url}/api/v1/lawyers/match",
                json={"practice_areas": practice_areas, "jurisdictions": jurisdictions, "limit": limit},
            )
            resp.raise_for_status()
            lawyers = [l for l in resp.json() if l.get("is_verified")]
    except Exception as exc:
        logger.warning("voice_find_lawyers_error error=%s", type(exc).__name__)
        return "The lawyer directory is unavailable right now. Please try again shortly.", []

    if not lawyers:
        return (
            "No matching verified lawyers in our directory for this matter. Suggest the State "
            "Bar Council or free legal aid on 15100.",
            [],
        )
    blocks = []
    for i, l in enumerate(lawyers, 1):
        areas = ", ".join((l.get("practice_areas") or [])[:3])
        blocks.append(
            f"{i}. {l.get('full_name', '')} — {areas} — {l.get('years_experience', 0)} yrs — "
            f"fee: {format_fee(l)} [booking_id:{l.get('id', '')}]"
        )
    return (
        "Verified lawyers from our directory:\n"
        + "\n".join(blocks)
        + "\nBefore booking, tell the user the name, slot and fee and get a clear yes.",
        lawyers,
    )


async def _run_book_appointment(args: dict, token: str, marketplace_url: str) -> tuple[str, dict | None]:
    if not args.get("user_confirmed_fee"):
        return (
            "Not booked. First tell the user the lawyer's name, the date and time slot and the "
            "consultation fee, and ask them to confirm.",
            None,
        )
    lawyer_id = args.get("lawyer_id", "")
    date = args.get("date", "")
    time_slot = args.get("time_slot", "")
    summary = args.get("matter_summary", "")
    if not lawyer_id or not date or not time_slot or len(summary) < 10:
        return "I need the lawyer, the date, the time and a short description of the matter first.", None
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(
                f"{marketplace_url}/api/v1/appointments",
                json={
                    "lawyer_id": lawyer_id,
                    "date": date,
                    "time_slot": time_slot,
                    "matter_summary": summary,
                    "source": "ai_match",
                    "citizen_name": args.get("citizen_name", "") or "",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            appt: dict = resp.json()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 402:
            return "Not booked: the wallet balance is too low for this consultation.", None
        detail = ""
        with suppress(Exception):
            detail = exc.response.json().get("detail", "")
        return f"I couldn't book it: {detail or 'please try another time or lawyer.'}", None
    except Exception as exc:
        logger.warning("voice_book_appointment_error error=%s", type(exc).__name__)
        return "The booking service is temporarily unavailable. Please try again in a moment.", None

    name = appt.get("lawyer_name", "the advocate")
    slot = appt.get("time_slot", time_slot)
    when = appt.get("date", date)
    if appt.get("status") == "confirmed":
        return f"Consultation with {name} confirmed for {when} at {slot}.", appt
    return f"Consultation request sent to {name} for {when} at {slot}; they will confirm shortly.", appt


async def _handle_tool_call(
    gemini_ws, client_ws: WebSocket, tool_call: dict, *, token: str, allowed: set[str],
    tavily_key: str, marketplace_url: str,
) -> None:
    responses: list[dict] = []
    for call in tool_call.get("functionCalls", []):
        fn_name: str = call.get("name", "")
        fn_args: dict = call.get("args", {}) or {}
        with suppress(Exception):
            await client_ws.send_json({"type": "state", "value": "thinking"})

        if fn_name not in allowed:
            result = "That action is not available in this session."
        elif fn_name == "legal_search":
            result = await _run_legal_search(fn_args.get("query", ""), fn_args.get("top_k", 6), token)
        elif fn_name == "web_search":
            result = await _run_web_search(fn_args.get("query", ""), fn_args.get("num_results", 3), tavily_key)
        elif fn_name == "find_lawyers":
            result, lawyers = await _run_find_lawyers(
                _parse_csv(fn_args.get("practice_areas", "")),
                _parse_csv(fn_args.get("jurisdictions", "")),
                min(max(1, int(fn_args.get("limit", 3) or 3)), 5),
                marketplace_url,
            )
            if lawyers:
                with suppress(Exception):
                    await client_ws.send_json({"type": "lawyer_results", "lawyers": lawyers})
        else:  # book_appointment
            result, appt = await _run_book_appointment(fn_args, token, marketplace_url)
            if appt:
                with suppress(Exception):
                    await client_ws.send_json({"type": "appointment_booked", "appointment": appt})
        responses.append({"id": call.get("id", ""), "name": fn_name, "response": {"output": result}})

    await gemini_ws.send(json.dumps({"tool_response": {"function_responses": responses}}))


async def _authenticate(websocket: WebSocket, token: str) -> tuple[CurrentUser, bool] | None:
    try:
        payload = decode_token(token, expected_type=TokenType.ACCESS)
    except JWTError:
        await websocket.send_json({"type": "error", "message": "Session expired. Please sign in again."})
        await websocket.close(code=4001, reason="Unauthorized")
        return None
    user = CurrentUser(user_id=payload.sub, roles=payload.roles, permissions=payload.permissions)
    if not user.is_guest:
        return user, False
    # Guest tokens are single-use: the jti minted by /voice/guest-token is consumed here.
    container = get_container()
    consumed = True
    if container.redis:
        consumed = bool(await container.redis.delete(f"voice:guest:jti:{payload.jti}"))
    if not consumed:
        await websocket.send_json({"type": "error", "message": "This voice preview has already been used."})
        await websocket.close(code=4001, reason="Token already used")
        return None
    return user, True


@voice_router.websocket("/voice/live")
async def voice_live(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token (query param, browser WS limitation)"),
) -> None:
    # Accept before auth — close() before accept() sends HTTP 403 instead of a WS code.
    await websocket.accept()
    auth = await _authenticate(websocket, token)
    if auth is None:
        return
    user, is_guest = auth
    user_id = None if is_guest else user.user_id
    role = primary_role(None if is_guest else user)

    container = get_container()
    if not is_guest:
        try:
            await check_rate_limit(container.redis, key=f"rate:voice:{user_id}", limit=5, window_seconds=60)
        except Exception as exc:
            if getattr(exc, "status_code", None) == 429:
                await websocket.send_json({"type": "error", "message": "Too many voice sessions. Please wait a moment."})
                await websocket.close(code=4029, reason="Rate limit exceeded")
                return
        if CHATBOT_FEE > 0 and not await billing.has_balance(user_token=token, minimum=CHATBOT_FEE):
            await websocket.send_json({"type": "error", "message": "Your wallet balance is too low to start voice."})
            await websocket.close(code=4402, reason="Insufficient balance")
            return

    llm_cfg = container.settings.llm
    live_model: str = llm_cfg.voice_live_model
    tavily_key: str = llm_cfg.tavily_api_key
    marketplace_url: str = llm_cfg.marketplace_base_url
    allowed = {t["name"] for t in _tools_for(is_guest=is_guest, role=role)}

    await websocket.send_json({"type": "ready"})
    prior_turns: list[dict] = []
    client_session_id: str | None = None
    locale = "en-IN"
    with suppress(Exception):
        msg = json.loads(await asyncio.wait_for(websocket.receive_text(), timeout=3.0))
        if msg.get("type") == "context":
            prior_turns = _context_turns(msg.get("messages") or [])
            client_session_id = (msg.get("session_id") or None) and str(msg["session_id"])[:100]
            locale = str(msg.get("locale") or "en-IN")[:10]
    sid = scoped_session_id(client_session_id, user_id=user_id, is_guest=is_guest)

    logger.info("voice_session_started guest=%s", is_guest)
    try:
        api_key = llm_cfg.llm_api_key
        if api_key.startswith("AQ."):
            gemini_url, gemini_headers = _GEMINI_LIVE_WS, {"x-goog-api-key": api_key}
        else:
            gemini_url, gemini_headers = f"{_GEMINI_LIVE_WS}?key={api_key}", {}
        async with websockets.connect(
            gemini_url,
            additional_headers=gemini_headers,
            max_size=10 * 1024 * 1024,
            ssl=_SSL_CTX,
        ) as gemini_ws:
            await gemini_ws.send(json.dumps(
                _setup_msg(voice=llm_cfg.tts_voice, model=live_model, is_guest=is_guest, role=role)
            ))
            try:
                first = json.loads(await gemini_ws.recv())
            except Exception:
                first = {}
            if "setupComplete" not in first:
                logger.error("voice_setup_failed model=%s", live_model)
                await websocket.send_json({"type": "error", "message": "Voice is unavailable right now. Please try again."})
                await websocket.close()
                return

            # Prior text chat as real turns, then a cue to greet or continue.
            cue = (
                "(The user has switched from text chat to voice. Briefly acknowledge what we were "
                "discussing and continue — do not re-introduce yourself.)"
                if prior_turns
                else "(The user has opened voice. Greet them now.)"
            )
            if locale.lower().startswith("hi"):
                cue += " (Their app is set to Hindi: speak Hindi unless they use another language.)"
            await gemini_ws.send(json.dumps({
                "clientContent": {
                    "turns": [*prior_turns, {"role": "user", "parts": [{"text": cue}]}],
                    "turnComplete": True,
                }
            }))
            await websocket.send_json({"type": "state", "value": "listening"})

            async def _browser_to_gemini() -> None:
                try:
                    while True:
                        data = await websocket.receive()
                        if data.get("type") == "websocket.disconnect":
                            break
                        raw_bytes = data.get("bytes")
                        if raw_bytes:
                            await gemini_ws.send(json.dumps({
                                "realtimeInput": {
                                    "audio": {
                                        "data": base64.b64encode(raw_bytes).decode(),
                                        "mimeType": "audio/pcm;rate=16000",
                                    }
                                }
                            }))
                            continue
                        raw_text = data.get("text")
                        if raw_text:
                            with suppress(Exception):
                                if json.loads(raw_text).get("type") == "interrupt":
                                    await gemini_ws.send(json.dumps({"clientContent": {"turnComplete": True}}))
                except (WebSocketDisconnect, RuntimeError):
                    pass
                except Exception as exc:
                    logger.warning("voice_browser_to_gemini_error error=%s", type(exc).__name__)
                finally:
                    with suppress(Exception):
                        await gemini_ws.close()

            async def _gemini_to_browser() -> None:
                speaking = False
                greeted = False  # the automatic greeting turn is never billed
                in_buf: list[str] = []
                out_buf: list[str] = []

                async def _flush(*, discard_output: bool = False) -> tuple[str, str]:
                    user_text = " ".join(in_buf).strip()
                    reply_text = "" if discard_output else " ".join(out_buf).strip()
                    in_buf.clear()
                    out_buf.clear()
                    with suppress(Exception):
                        if user_text:
                            await websocket.send_json({"type": "transcript", "role": "user", "text": user_text})
                        if reply_text:
                            await websocket.send_json({"type": "transcript", "role": "assistant", "text": reply_text})
                    return user_text, reply_text

                try:
                    async for raw in gemini_ws:
                        msg: dict = json.loads(raw)
                        if "goAway" in msg:
                            logger.info("voice_go_away")
                            continue
                        if "toolCall" in msg:
                            speaking = False
                            await _handle_tool_call(
                                gemini_ws, websocket, msg["toolCall"], token=token, allowed=allowed,
                                tavily_key=tavily_key, marketplace_url=marketplace_url,
                            )
                            continue

                        sc: dict = msg.get("serverContent", {})
                        chunk = (sc.get("inputTranscription") or {}).get("text", "").strip()
                        if chunk:
                            in_buf.append(chunk)
                        chunk = (sc.get("outputTranscription") or {}).get("text", "").strip()
                        if chunk:
                            out_buf.append(chunk)

                        if sc.get("interrupted"):
                            speaking = False
                            await _flush(discard_output=True)
                            with suppress(Exception):
                                await websocket.send_json({"type": "interrupted"})
                                await websocket.send_json({"type": "state", "value": "listening"})
                            continue

                        if sc.get("turnComplete"):
                            speaking = False
                            user_text, reply_text = await _flush()
                            if not greeted:
                                greeted = True
                            elif user_text and reply_text:
                                if sid:
                                    spawn(container.memory_manager.persist(
                                        session_id=sid, user_id=user_id,
                                        user_content=user_text, assistant_content=reply_text,
                                    ))
                                if user_id and CHATBOT_FEE > 0:
                                    spawn(billing.deduct_chatbot_query(
                                        user_id=user_id, fee=CHATBOT_FEE, session_id=client_session_id,
                                        description="AI legal assistant voice turn",
                                    ))
                            with suppress(Exception):
                                await websocket.send_json({"type": "state", "value": "listening"})
                            continue

                        for part in (sc.get("modelTurn") or {}).get("parts", []):
                            inline = part.get("inlineData", {})
                            if inline.get("mimeType", "").startswith("audio/pcm") and inline.get("data"):
                                if not speaking:
                                    speaking = True
                                    with suppress(Exception):
                                        await websocket.send_json({"type": "state", "value": "speaking"})
                                with suppress(Exception):
                                    await websocket.send_bytes(base64.b64decode(inline["data"]))
                except Exception as exc:
                    logger.warning("voice_gemini_to_browser_error error=%s", type(exc).__name__)
                finally:
                    # No idle state here — the browser's onclose handles session end.
                    with suppress(Exception):
                        await websocket.close()

            session = asyncio.gather(_browser_to_gemini(), _gemini_to_browser())
            limit = GUEST_SESSION_SECONDS if is_guest else MEMBER_SESSION_SECONDS
            try:
                await asyncio.wait_for(session, timeout=limit)
            except asyncio.TimeoutError:
                session.cancel()
                with suppress(Exception):
                    if is_guest:
                        await websocket.send_json({"type": "guest_ended"})
                        await websocket.close(code=4090, reason="Guest session ended")
                    else:
                        await websocket.send_json({"type": "error", "message": "Voice sessions last up to 15 minutes. Tap to start a new one."})
                        await websocket.close(code=4408, reason="Session time limit")
    except Exception as exc:
        logger.error("voice_session_error error=%s", type(exc).__name__)
        with suppress(Exception):
            await websocket.send_json({"type": "error", "message": "Voice is unavailable right now. Please try again."})
        with suppress(Exception):
            await websocket.close()
    finally:
        logger.info("voice_session_ended guest=%s", is_guest)
