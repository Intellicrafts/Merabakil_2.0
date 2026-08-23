"""Gemini Multimodal Live API — bidirectional WebSocket proxy with tool calling.

Architecture:
  Browser (mic PCM 16kHz) ──ws──► [this endpoint] ──ws──► Gemini Live
  Browser (audio playback) ◄──ws── [this endpoint] ◄──ws── Gemini Live
                                         ▲
                                   tool calls:
                                   legal_search  → container.retriever
                                   web_search    → search_web_text()
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

_SSL_CTX = ssl.create_default_context(cafile=certifi.where())
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.infrastructure.container import get_container
from legalos_common.clients.web_search import search_web_text
from legalos_common.security.jwt import TokenType, decode_token

logger = logging.getLogger(__name__)
voice_router = APIRouter(prefix="/api/v1/research", tags=["voice"])

_GEMINI_LIVE_WS = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
)

_SYSTEM_PROMPT = """\
You are Mera Vakil, an expert AI legal counsel specialising in Indian law. \
You are in a real-time voice conversation — be conversational, warm, and concise.

## Language — follow the user exactly
Detect the language the user speaks and respond in EXACTLY that same language for the entire reply.
- Hindi → respond fully in Hindi
- Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi → respond in that language
- Hinglish (mixed Hindi + English) → mirror the same natural mix
- Legal terms that are always used in English in India (IPC, Section 420, FIR, PIL, High Court, \
Supreme Court) may stay in English even inside a Hindi or regional-language reply — \
this is authentic Indian legal speech
- If the user switches language mid-conversation, switch with them immediately
- Default to English ONLY if the user's first message is in English

## Internal tools — NEVER mention to the user
You have internal tools (legal_search, web_search, find_lawyers) but the user must NEVER know \
about them. Do NOT say:
- "let me search", "searching now", "looking that up", "I found in legal_search", \
"according to web_search", "calling find_lawyers", "tool", "database", "knowledge base", \
"my search results", or any similar phrase
While a tool is running, say something brief and natural like "Let me check that." or \
"One moment." — then speak the answer directly as your own knowledge.
Cite statutes and cases naturally in speech: "Under Section 420 of the IPC..." not \
"According to my search, Section 420...".

## Tool usage (silent, internal)
Always call legal_search or web_search before answering any legal question. \
Never guess statutes, case citations, or constitutional provisions.
- Use legal_search first for Indian statutes, IPC sections, constitutional articles, case law.
- Use web_search ONLY for recent events or judgments after 2023, or when legal_search returns \
nothing. NEVER use web_search to find or suggest lawyers.
- Call find_lawyers when the user asks to be connected with, referred to, or wants to hire a \
lawyer, advocate, or legal professional, or when the matter clearly needs representation \
(criminal charges, court proceedings, property disputes, divorce, company incorporation, etc.).

## Lawyer recommendations — STRICT RULES
NEVER name, suggest, or describe a lawyer from your own knowledge or training data. \
Lawyer names from your training may be outdated, fabricated, or incorrect. \
You MUST call find_lawyers first, then recommend ONLY the lawyers returned by that tool. \
If find_lawyers returns no results, say the directory has no matching lawyers right now \
and suggest the user contact the Bar Council of India — do NOT invent names as a fallback. \
web_search must NEVER be used as an alternative to find_lawyers for lawyer lookup.

## Voice response style
- Keep replies to 2–4 sentences for simple questions; up to 60 s for complex topics.
- Never read out full URLs or long citation strings — say "under Section 420 of the IPC" \
or "per the Supreme Court's ruling in that case".
- After a substantive answer, invite follow-up in the user's language.
- Scope: Indian law only. Politely decline other jurisdictions.
- For matters with serious legal consequences, remind the user to consult a licensed advocate.\
"""

_TOOL_DECLARATIONS = [
    {
        "name": "legal_search",
        "description": (
            "Search the Indian legal knowledge base — statutes, Constitution, IPC, CrPC, "
            "CGST, Companies Act, case law, and more. Use as the primary tool for any "
            "legal question requiring accurate citation."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "Specific legal question or topic. Include article numbers, "
                        "legal terms, or case names when known."
                    ),
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of results to retrieve (1–12, default 6).",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "web_search",
        "description": (
            "Search the web for recent Indian legal news, Supreme Court judgments, "
            "and current legal developments. Use for post-2023 events or when the "
            "knowledge base returns insufficient results. "
            "Do NOT use this tool to find or suggest lawyers — use find_lawyers instead."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query — Indian law context is added automatically.",
                },
                "num_results": {
                    "type": "integer",
                    "description": "Number of results (1–5, default 3).",
                },
            },
            "required": ["query"],
        },
    },
    {
        "name": "find_lawyers",
        "description": (
            "Find and recommend verified Indian lawyers from the marketplace. "
            "Call this when the user wants to hire a lawyer, needs legal representation, "
            "or when the matter (criminal case, court filing, divorce, property dispute, "
            "company incorporation, etc.) clearly requires a licensed advocate."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "practice_areas": {
                    "type": "string",
                    "description": (
                        "Comma-separated practice areas relevant to the user's matter, "
                        "e.g. 'Criminal Law,Bail' or 'Family Law,Divorce' or 'Corporate Law'. "
                        "Use the areas most relevant to the matter."
                    ),
                },
                "jurisdictions": {
                    "type": "string",
                    "description": (
                        "Comma-separated states or cities, e.g. 'Delhi,Haryana' or 'Kerala'. "
                        "Leave empty string if jurisdiction is not known or all-India."
                    ),
                },
                "limit": {
                    "type": "integer",
                    "description": "Number of lawyers to return (1–5, default 3).",
                },
            },
            "required": ["practice_areas"],
        },
    },
]


def _setup_msg(voice: str, model: str) -> dict:
    return {
        "setup": {
            "model": f"models/{model}",
            "generation_config": {
                "response_modalities": ["AUDIO"],
                "speech_config": {
                    "voice_config": {
                        "prebuilt_voice_config": {"voice_name": voice}
                    }
                },
            },
            # Transcription fields must be at setup level, NOT inside generation_config
            "input_audio_transcription": {},
            "output_audio_transcription": {},
            "system_instruction": {"parts": [{"text": _SYSTEM_PROMPT}]},
            "tools": [{"function_declarations": _TOOL_DECLARATIONS}],
        }
    }


async def _run_legal_search(query: str, top_k: int, user_id: str) -> str:
    container = get_container()
    try:
        results = await container.retriever.retrieve(
            query,
            top_k=min(max(1, top_k), 12),
            filters=None,
            user_token=user_id,
        )
    except Exception as exc:
        logger.warning("voice_live legal_search error: %s", exc)
        return "No relevant documents found in the knowledge base."

    if not results:
        return "No relevant documents found in the Indian legal knowledge base for this query."

    parts: list[str] = []
    for i, src in enumerate(results, 1):
        header = f"[KB-{i}]"
        if src.title:
            header += f" {src.title}"
        if src.citation:
            header += f" | {src.citation}"
        parts.append(f"{header}\n{src.content[:600]}")
    return "\n\n---\n\n".join(parts)


async def _run_web_search(query: str, num_results: int, tavily_key: str) -> str:
    try:
        results = await search_web_text(
            f"{query} India law",
            max_results=min(max(1, num_results), 5),
            tavily_api_key=tavily_key,
        )
    except Exception as exc:
        logger.warning("voice_live web_search error: %s", exc)
        return "Web search is currently unavailable."

    if not results:
        return "No relevant web results found."

    parts: list[str] = []
    for i, r in enumerate(results, 1):
        parts.append(f"[WEB-{i}] {r.title}\nURL: {r.url}\n{r.snippet[:400]}")
    return "\n\n---\n\n".join(parts)


def _parse_csv(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


async def _run_find_lawyers(
    practice_areas: list[str],
    jurisdictions: list[str],
    limit: int,
    marketplace_url: str,
) -> tuple[str, list[dict]]:
    """Call the marketplace service and return (text_for_gemini, raw_lawyers)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{marketplace_url}/api/v1/lawyers/match",
                json={"practice_areas": practice_areas, "jurisdictions": jurisdictions, "limit": limit},
            )
            resp.raise_for_status()
            lawyers: list[dict] = resp.json()
    except Exception as exc:
        logger.warning("voice_live find_lawyers error: %s", exc)
        return "I wasn't able to reach the lawyer directory right now. Please try again shortly.", []

    if not lawyers:
        return (
            "I couldn't find matching lawyers in our directory for those criteria. "
            "You may want to search the Bar Council of India website directly.",
            [],
        )

    lines = []
    for i, l in enumerate(lawyers, 1):
        name = l.get("full_name", "Unknown")
        areas = ", ".join(l.get("practice_areas", [])[:2])
        yrs = l.get("years_experience", 0)
        rating = l.get("rating", 0)
        bar = l.get("bar_council_id") or "N/A"
        verified = "✓ Verified" if l.get("is_verified") else ""
        lines.append(f"{i}. {name} — {areas} | {yrs} yrs exp | Rating {rating}/5 {verified} | Bar ID: {bar}")

    text = (
        "Here are the top matching lawyers from our verified directory:\n\n"
        + "\n".join(lines)
        + "\n\nShall I share more details about any of them?"
    )
    return text, lawyers


async def _handle_tool_call(
    gemini_ws: websockets.WebSocketClientProtocol,
    client_ws: WebSocket,
    tool_call: dict,
    user_id: str,
    tavily_key: str,
    marketplace_url: str,
) -> None:
    """Execute all function calls in a toolCall message and send responses."""
    responses: list[dict] = []

    for call in tool_call.get("functionCalls", []):
        fn_name: str = call.get("name", "")
        fn_args: dict = call.get("args", {})
        fn_id: str = call.get("id", "")

        # Notify browser that a tool is running
        with suppress(Exception):
            await client_ws.send_json({"type": "state", "value": "thinking"})

        if fn_name == "legal_search":
            result = await _run_legal_search(
                fn_args.get("query", ""),
                fn_args.get("top_k", 6),
                user_id,
            )
        elif fn_name == "web_search":
            result = await _run_web_search(
                fn_args.get("query", ""),
                fn_args.get("num_results", 3),
                tavily_key,
            )
        elif fn_name == "find_lawyers":
            result, lawyers = await _run_find_lawyers(
                _parse_csv(fn_args.get("practice_areas", "")),
                _parse_csv(fn_args.get("jurisdictions", "")),
                min(max(1, fn_args.get("limit", 3)), 5),
                marketplace_url,
            )
            if lawyers:
                with suppress(Exception):
                    await client_ws.send_json({"type": "lawyer_results", "lawyers": lawyers})
        else:
            result = f"Unknown tool: {fn_name}"

        responses.append({"id": fn_id, "name": fn_name, "response": {"output": result}})

    await gemini_ws.send(
        json.dumps({"tool_response": {"function_responses": responses}})
    )


@voice_router.websocket("/voice/live")
async def voice_live(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token (query param, browser WS limitation)"),
) -> None:
    """Bidirectional Gemini Live proxy.

    Browser sends:
      - Binary frames: raw Int16 PCM at 16 kHz mono (mic audio)
      - Text frames:   JSON {"type": "interrupt"} for user tap-to-stop

    Backend sends to browser:
      - Binary frames: raw Int16 PCM at 24 kHz mono (Gemini audio output)
      - Text frames:   JSON state signals — see _Signal below
    """
    # Accept before auth — calling close() before accept() sends HTTP 403 instead of WS 4001.
    await websocket.accept()

    try:
        payload = decode_token(token, expected_type=TokenType.ACCESS)
        user_id: str = payload.sub
    except JWTError as exc:
        logger.info("voice_live: auth rejected — %s", exc)
        await websocket.send_json({"type": "error", "message": "Session expired. Please log in again."})
        await websocket.close(code=4001, reason="Unauthorized")
        return

    logger.info("voice_live: session started user=%s", user_id)

    container = get_container()
    llm_cfg = container.settings.llm
    api_key: str = llm_cfg.llm_api_key
    live_model: str = llm_cfg.voice_live_model
    voice: str = llm_cfg.tts_voice
    tavily_key: str = llm_cfg.tavily_api_key
    marketplace_url: str = llm_cfg.marketplace_base_url

    if api_key.startswith("AQ."):
        gemini_url = _GEMINI_LIVE_WS
        gemini_headers = {"x-goog-api-key": api_key}
    else:
        gemini_url = f"{_GEMINI_LIVE_WS}?key={api_key}"
        gemini_headers = {}

    try:
        async with websockets.connect(
            gemini_url,
            additional_headers=gemini_headers,
            max_size=10 * 1024 * 1024,  # 10 MB — audio frames can be large
            ssl=_SSL_CTX,
        ) as gemini_ws:
            # ── Setup ───────────────────────────────────────────────────────
            await gemini_ws.send(json.dumps(_setup_msg(voice, live_model)))
            try:
                first = json.loads(await gemini_ws.recv())
            except Exception as exc:
                logger.error("voice_live: Gemini closed during setup user=%s: %s", user_id, exc)
                await websocket.send_json({"type": "error", "message": "Voice session unavailable. Please try again."})
                await websocket.close()
                return
            if "setupComplete" not in first:
                logger.warning("voice_live: unexpected setup response user=%s: %s", user_id, first)

            await websocket.send_json({"type": "state", "value": "listening"})

            # ── Browser → Gemini task ────────────────────────────────────────
            async def _browser_to_gemini() -> None:
                try:
                    while True:
                        data = await websocket.receive()
                        msg_type = data.get("type", "")

                        if msg_type == "websocket.disconnect":
                            break

                        raw_bytes = data.get("bytes")
                        if raw_bytes:
                            b64 = base64.b64encode(raw_bytes).decode()
                            await gemini_ws.send(json.dumps({
                                "realtimeInput": {
                                    "audio": {
                                        "data": b64,
                                        "mimeType": "audio/pcm;rate=16000",
                                    }
                                }
                            }))
                            continue

                        raw_text = data.get("text")
                        if raw_text:
                            ctrl = json.loads(raw_text)
                            if ctrl.get("type") == "interrupt":
                                # User tapped to barge in — tell Gemini to end its current turn
                                # immediately rather than waiting for its own VAD to detect speech.
                                with suppress(Exception):
                                    await gemini_ws.send(json.dumps({
                                        "clientContent": {"turnComplete": True}
                                    }))

                except WebSocketDisconnect:
                    logger.info("voice_live: browser disconnected cleanly user=%s", user_id)
                except RuntimeError as exc:
                    logger.info("voice_live: browser_to_gemini runtime error user=%s: %s", user_id, exc)
                except Exception as exc:
                    logger.warning("voice_live: browser_to_gemini unexpected error user=%s: %s", user_id, exc)
                finally:
                    with suppress(Exception):
                        await gemini_ws.close()

            # ── Gemini → Browser task ────────────────────────────────────────
            async def _gemini_to_browser() -> None:
                speaking_signalled = False
                # Transcript chunks arrive word-by-word from Gemini. Buffer them
                # and only emit a single message per completed turn so the frontend
                # stores one coherent user message and one assistant message rather
                # than dozens of fragments.
                in_buf: list[str] = []   # user speech chunks
                out_buf: list[str] = []  # assistant speech chunks

                async def _flush_transcripts(*, discard_output: bool = False) -> None:
                    """Send buffered transcripts and reset buffers."""
                    if in_buf:
                        text = " ".join(in_buf).strip()
                        in_buf.clear()
                        if text:
                            with suppress(Exception):
                                await websocket.send_json({"type": "transcript", "role": "user", "text": text})
                    if not discard_output and out_buf:
                        text = " ".join(out_buf).strip()
                        out_buf.clear()
                        if text:
                            with suppress(Exception):
                                await websocket.send_json({"type": "transcript", "role": "assistant", "text": text})
                    else:
                        out_buf.clear()

                try:
                    async for raw in gemini_ws:
                        msg: dict = json.loads(raw)

                        # Log unrecognised top-level keys so we can see what Gemini sends
                        known_keys = {"toolCall", "serverContent", "setupComplete"}
                        unknown = set(msg.keys()) - known_keys
                        if unknown:
                            logger.info("voice_live: unhandled Gemini msg keys=%s body=%s", unknown, str(msg)[:300])

                        # Tool call from Gemini
                        if "toolCall" in msg:
                            speaking_signalled = False
                            await _handle_tool_call(
                                gemini_ws, websocket, msg["toolCall"],
                                user_id, tavily_key, marketplace_url,
                            )
                            continue

                        server_content: dict = msg.get("serverContent", {})

                        # Buffer user speech transcription chunks
                        input_xscript = server_content.get("inputTranscription", {})
                        chunk = input_xscript.get("text", "").strip()
                        if chunk:
                            in_buf.append(chunk)

                        # Buffer assistant speech transcription chunks
                        output_xscript = server_content.get("outputTranscription", {})
                        chunk = output_xscript.get("text", "").strip()
                        if chunk:
                            out_buf.append(chunk)

                        # User barged in — Gemini interrupted itself
                        if server_content.get("interrupted"):
                            speaking_signalled = False
                            # Flush user input (they spoke); discard incomplete assistant output
                            await _flush_transcripts(discard_output=True)
                            with suppress(Exception):
                                await websocket.send_json({"type": "interrupted"})
                                await websocket.send_json({"type": "state", "value": "listening"})
                            continue

                        # Turn complete — emit both buffered transcripts as single messages
                        if server_content.get("turnComplete"):
                            speaking_signalled = False
                            await _flush_transcripts()
                            with suppress(Exception):
                                await websocket.send_json({"type": "state", "value": "listening"})
                            continue

                        # Audio output from model
                        model_turn: dict = server_content.get("modelTurn", {})
                        for part in model_turn.get("parts", []):
                            inline = part.get("inlineData", {})
                            mime = inline.get("mimeType", "")
                            if mime.startswith("audio/pcm") and inline.get("data"):
                                pcm_bytes = base64.b64decode(inline["data"])
                                # Signal speaking state once before first audio chunk
                                if not speaking_signalled:
                                    speaking_signalled = True
                                    with suppress(Exception):
                                        await websocket.send_json({"type": "state", "value": "speaking"})
                                with suppress(Exception):
                                    await websocket.send_bytes(pcm_bytes)

                except Exception as exc:
                    logger.warning("voice_live: gemini_to_browser error user=%s: %s", user_id, exc)
                finally:
                    speaking_signalled = False
                    # Do NOT send idle state here — the browser's ws.onclose handler
                    # already handles session end. Sending idle triggers the auto-reconnect
                    # loop on the frontend (idle → reconnect → session ends → idle → …).
                    with suppress(Exception):
                        await websocket.close()

            await asyncio.gather(_browser_to_gemini(), _gemini_to_browser())

    except Exception as exc:
        logger.error("voice_live: session error user=%s: %s", user_id, exc)
        with suppress(Exception):
            await websocket.send_json({"type": "error", "message": "Voice session unavailable. Please try again."})
        with suppress(Exception):
            await websocket.close()
    finally:
        logger.info("voice_live: session ended user=%s", user_id)
