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
from datetime import date as _date

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
You are Mera Vakil — a professional AI legal assistant specialising exclusively in Indian law. \
You speak with the calm authority of a senior counsel: precise, composed, and reassuring. \
This is a real-time voice conversation.

## Opening the conversation
At the very start of every new session, greet the user immediately with a brief, warm welcome — \
introduce yourself as Mera Vakil and invite them to share their legal concern. \
For example: "Namaste, I am Mera Vakil, your AI legal assistant for Indian law. \
How can I help you today?" Keep the opening to one or two sentences.

## Strict scope — Indian legal matters only
You handle ONLY questions related to Indian law, legal rights, statutes, court procedures, \
and lawyer referrals. If the user asks about anything outside this scope — general knowledge, \
cooking, entertainment, technology, other countries' laws, or anything unrelated to Indian legal \
matters — politely decline in the user's language and bring the conversation back to how you can \
help with their legal situation. Never engage with off-topic requests even briefly.

## Language and tone — mirror the user exactly
- Detect the user's language from their very first message and respond in that exact language \
throughout the conversation.
- Hindi → respond fully in Hindi with a formal, respectful tone.
- Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi → respond fully in \
that language with the same formal register.
- Hinglish → mirror the same natural code-switching the user uses.
- Legal terms always used in English in India (IPC, FIR, PIL, Section 302, High Court, \
Supreme Court, CrPC, RERA, GST) may remain in English even inside a Hindi or regional reply — \
this is how practising lawyers actually speak in India.
- If the user switches language mid-conversation, switch with them immediately.
- Default to formal English only if the user's first message is in English.
- Tone is always professional and empathetic — never casual, never dismissive.

## Gathering information before advising
When a user first describes their legal problem, ask 1–2 focused follow-up questions to \
understand the key facts (e.g. jurisdiction, nature of dispute, urgency, parties involved) \
before giving detailed advice. Do not interrogate — gather just enough context to give useful, \
accurate guidance and to match them with the right type of lawyer.

## Proactively suggesting lawyers
Once you have understood the user's matter — even if they have not explicitly asked for a lawyer \
— proactively offer to connect them with a verified advocate if the situation clearly warrants \
professional representation. Triggers include: criminal charges, FIR, arrest, bail, property \
dispute, divorce, custody, contract breach, employment termination, company registration, court \
notice, consumer complaint, or any matter likely to go to court. \
Ask: "Would you like me to find a verified advocate who handles these matters?" \
If they agree, call find_lawyers immediately.

## Lawyer referrals — absolute rules
- NEVER name, describe, or suggest any lawyer from your own knowledge or training data. \
  Names from training data may be fabricated or outdated — this could seriously mislead the user.
- ALWAYS call find_lawyers before mentioning any lawyer by name. \
  Recommend ONLY the advocates returned by that service, using the details it provides.
- If find_lawyers returns no results, say: "Our verified directory does not have a matching \
  advocate listed right now. I would suggest contacting the Bar Council of India or the State \
  Bar Council directly." Never invent names as a fallback.
- Do not use web search to find lawyers. The find_lawyers service is the only authorised source.

## How to use your capabilities (never mention these to the user)
You have capabilities that work silently in the background. Never say "searching", "looking up", \
"calling a tool", "database", "knowledge base", "API", "system", or any technical phrase. \
If you need a moment, say something natural like "Let me check on that." or \
"Give me just a moment." — then deliver the answer as your own knowledge.
- For any legal question — statutes, sections, constitutional articles, case law, procedures — \
  look it up before answering. Never guess a section number or case citation.
- For recent developments, Supreme Court orders, or events after 2023, use a current news lookup.
- For finding advocates, use the verified lawyer directory — always, without exception.
Always cite naturally in speech: "Under Section 138 of the Negotiable Instruments Act..." \
not "I found that Section 138...". Never read out URLs.

## Booking a consultation — proactive and seamless
After find_lawyers returns results, always offer to book a consultation immediately. \
If the user agrees (or says "yes", "book it", "haan", "theek hai", or any affirmative), \
proceed to gather what you need and call book_appointment right away — do not ask for \
unnecessary confirmation. \
Rules: \
- Use the lawyer's id from the find_lawyers result as lawyer_id. \
- Use today's date (provided in the session context below) in YYYY-MM-DD format as date. \
- Default time_slot to "Immediate" unless the user specifies a time (e.g., "10 AM" → "10:00 AM"). \
- Derive matter_summary from the conversation so far — a concise one-sentence description of the \
  user's legal situation. Never ask the user to repeat what they already told you. \
- If the user's name came up naturally in conversation, use it as citizen_name; otherwise \
  pass an empty string and the system will use their registered name. \
- After a successful booking, confirm naturally: "Your consultation with [name] has been booked \
  for today. You will receive a confirmation shortly." \
- If booking fails (slot taken, lawyer unavailable, etc.), relay the reason plainly and offer \
  to try another lawyer or a different time.

## Response style for voice
- Speak in complete, flowing sentences — avoid bullet points or lists in your spoken response.
- Keep answers to 3–5 sentences for straightforward questions; longer for complex matters.
- After answering, invite the user to share more or ask a follow-up, in their own language.
- Never reveal anything about your technical architecture, the platform, or how you work internally.\
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
    {
        "name": "book_appointment",
        "description": (
            "Book a consultation appointment with a verified lawyer on the platform. "
            "Call this AFTER find_lawyers has returned results and the user agrees to book. "
            "Use the lawyer's id from the find_lawyers result. "
            "Derive matter_summary from the conversation — never ask the user to repeat themselves. "
            "Default time_slot to 'Immediate' unless the user specifies a time."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "lawyer_id": {
                    "type": "string",
                    "description": "UUID of the lawyer from the find_lawyers result.",
                },
                "date": {
                    "type": "string",
                    "description": (
                        "Consultation date in YYYY-MM-DD format. "
                        "Use today's date (provided in session context) unless user specifies otherwise."
                    ),
                },
                "time_slot": {
                    "type": "string",
                    "description": (
                        "'Immediate' for right now, or a specific time like '10:00 AM'. "
                        "Default to 'Immediate' unless the user specifies a time."
                    ),
                },
                "matter_summary": {
                    "type": "string",
                    "description": (
                        "One-to-two sentence summary of the user's legal matter, "
                        "derived from the conversation. Minimum 10 characters."
                    ),
                },
                "citizen_name": {
                    "type": "string",
                    "description": (
                        "User's full name if they mentioned it; otherwise pass empty string."
                    ),
                },
            },
            "required": ["lawyer_id", "date", "time_slot", "matter_summary"],
        },
    },
]


def _setup_msg(voice: str, model: str, today_date: str) -> dict:
    system_text = (
        _SYSTEM_PROMPT
        + f"\n\n## Session context\nToday's date: {today_date} (use this when booking appointments)."
    )
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
            "system_instruction": {"parts": [{"text": system_text}]},
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

    blocks = []
    for i, l in enumerate(lawyers, 1):
        name = l.get("full_name", "Unknown")
        areas = ", ".join(l.get("practice_areas", [])[:3])
        yrs = l.get("years_experience", 0)
        rating = l.get("rating", 0)
        bar = l.get("bar_council_id") or "N/A"
        verified = "✓ Verified" if l.get("is_verified") else ""
        summary = l.get("summary", "").strip()
        header = f"{i}. {name} — {areas} | {yrs} yrs exp | Rating {rating}/5 {verified} | Bar ID: {bar}"
        block = header + (f"\n   {summary}" if summary else "")
        blocks.append(block)

    text = (
        "Here are the top matching lawyers from our verified directory:\n\n"
        + "\n\n".join(blocks)
        + "\n\nWould you like to know more about any of them or book a consultation?"
    )
    return text, lawyers


async def _run_book_appointment(
    lawyer_id: str,
    date: str,
    time_slot: str,
    matter_summary: str,
    citizen_name: str,
    token: str,
    marketplace_url: str,
) -> tuple[str, dict | None]:
    """Book a consultation via the marketplace service and return (gemini_text, appt_dict)."""
    if not lawyer_id or not date or not time_slot or len(matter_summary) < 10:
        return (
            "I need a few more details — specifically the lawyer, date, time, and a brief "
            "description of your matter — before I can book the appointment.",
            None,
        )
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(
                f"{marketplace_url}/api/v1/appointments",
                json={
                    "lawyer_id": lawyer_id,
                    "date": date,
                    "time_slot": time_slot,
                    "matter_summary": matter_summary,
                    "source": "ai_match",
                    "citizen_name": citizen_name or "",
                },
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            appt: dict = resp.json()
    except httpx.HTTPStatusError as exc:
        detail = ""
        with suppress(Exception):
            detail = exc.response.json().get("detail", "")
        logger.warning("voice_live book_appointment http_error=%s detail=%s", exc, detail)
        return f"I wasn't able to book the appointment: {detail or 'please try again shortly.'}.", None
    except Exception as exc:
        logger.warning("voice_live book_appointment error=%s", exc)
        return "The booking service is temporarily unavailable. Please try again in a moment.", None

    lawyer_name = appt.get("lawyer_name", "the advocate")
    slot = appt.get("time_slot", time_slot)
    appt_date = appt.get("date", date)
    status = appt.get("status", "requested")

    if status == "confirmed":
        text = (
            f"Your consultation with {lawyer_name} has been confirmed for {appt_date} at {slot}. "
            "You will receive a confirmation shortly. Is there anything else I can help you with?"
        )
    else:
        text = (
            f"Your consultation request with {lawyer_name} has been sent for {appt_date} at {slot}. "
            "They will confirm your appointment shortly. Is there anything else I can help you with?"
        )
    return text, appt


async def _handle_tool_call(
    gemini_ws: websockets.WebSocketClientProtocol,
    client_ws: WebSocket,
    tool_call: dict,
    user_id: str,
    token: str,
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
        elif fn_name == "book_appointment":
            result, appt = await _run_book_appointment(
                lawyer_id=fn_args.get("lawyer_id", ""),
                date=fn_args.get("date", ""),
                time_slot=fn_args.get("time_slot", "Immediate"),
                matter_summary=fn_args.get("matter_summary", ""),
                citizen_name=fn_args.get("citizen_name", ""),
                token=token,
                marketplace_url=marketplace_url,
            )
            if appt:
                with suppress(Exception):
                    await client_ws.send_json({"type": "appointment_booked", "appointment": appt})
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
            today_date = _date.today().strftime("%Y-%m-%d")
            await gemini_ws.send(json.dumps(_setup_msg(voice, live_model, today_date)))
            try:
                first = json.loads(await gemini_ws.recv())
            except Exception as exc:
                logger.error("voice_live: Gemini closed during setup user=%s: %s", user_id, exc)
                await websocket.send_json({"type": "error", "message": "Voice session unavailable. Please try again."})
                await websocket.close()
                return
            if "setupComplete" not in first:
                logger.error("voice_live: Gemini setup FAILED user=%s response=%s", user_id, first)
                await websocket.send_json({"type": "error", "message": "Voice session unavailable. Please try again."})
                await websocket.close()
                return

            logger.info("voice_live: Gemini setup OK model=%s voice=%s user=%s", live_model, voice, user_id)

            # Trigger Gemini to deliver an opening greeting immediately.
            # Without this, Gemini waits for user audio before speaking, which
            # means the audio pipeline is untested until the user speaks.
            await gemini_ws.send(json.dumps({
                "clientContent": {
                    "turns": [{"role": "user", "parts": [{"text": "begin"}]}],
                    "turnComplete": True,
                }
            }))

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

                        # Diagnostic: log what's inside serverContent
                        if "serverContent" in msg:
                            sc = msg["serverContent"]
                            sc_keys = list(sc.keys())
                            has_audio = False
                            mt = sc.get("modelTurn", {})
                            for p in mt.get("parts", []):
                                if p.get("inlineData", {}).get("mimeType", "").startswith("audio/"):
                                    has_audio = True
                            logger.info(
                                "voice_live: serverContent user=%s keys=%s has_audio=%s turnComplete=%s",
                                user_id, sc_keys, has_audio, sc.get("turnComplete", False),
                            )

                        # Tool call from Gemini
                        if "toolCall" in msg:
                            speaking_signalled = False
                            await _handle_tool_call(
                                gemini_ws, websocket, msg["toolCall"],
                                user_id, token, tavily_key, marketplace_url,
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
