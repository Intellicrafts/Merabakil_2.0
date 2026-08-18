"""Grounded courtroom turn generation — retrieve then speak from verified sources."""

from __future__ import annotations

import json
import re
from typing import Any

from app.api.schemas import (
    CourtroomExhibitAction,
    CourtroomTurnRequest,
    CourtroomTurnResponse,
    CourtroomVerifiedSource,
)
from app.infrastructure.llm_json import complete_json
from app.infrastructure.search_retriever import HttpSearchRetriever
from legalos_common.clients.llm import LLMClient
from legalos_common.clients.web_search import search_web_text
from legalos_common.rag.filters import SearchFilters
from legalos_common.rag.schemas import RetrievedSource

_JSON_BLOCK_RE = re.compile(r"\{[\s\S]*\}")

_SYSTEM = """You are generating ONE utterance inside an AI SIMULATION of an Indian court hearing
(educational case-strength analysis — NOT a real court; not legal advice).

Respond ONLY with valid JSON matching this schema:
{
  "speaker": "judge|petitioner|respondent",
  "text": "English courtroom utterance (2-6 sentences)",
  "textHi": "optional Hindi companion of same meaning",
  "addressesPointIds": ["pt-1"],
  "citeSourceIds": ["c1", "w1"],
  "exhibitActions": [{"exhibitId": "ex-1", "status": "marked|admitted|rejected"}],
  "suggestJudgeIntervene": false,
  "timelineStep": "appearance|issues_framed|evidence_marking|submissions|reply|closing|verdict|deliberation",
  "judgeState": "listening|questioning|ruling|deliberating",
  "judgeNote": "optional short note if judge"
}

RULES:
- Speak ONLY as the requested speaker role.
- Address Bench as "My Lords" / "Your Lordship" (advocates); Bench addresses "Counsel".
- Cite ONLY from VERIFIED SOURCES listed (use citeSourceIds). Do NOT invent statutes,
  case names, sections, or exhibits absent from the case record / verified sources.
- Prefer Indian procedural idioms: pleadings, issues, prayer, burden of proof, onus, record.
- Prefer addressing uncovered agenda points.
- If speaker is counsel and phase is evidence_marking, may propose exhibitActions to mark/admit.
- If judge and phase is evidence_marking, may admit/reject exhibits that were marked.
- This is NOT binding legal advice.
"""


def _retrieval_query(body: CourtroomTurnRequest) -> str:
    agenda_bits = [
        a.label
        for a in body.agenda
        if a.status in {"pending", "raised"} or a.id in (body.focus_point_ids or [])
    ]
    focus = "; ".join(agenda_bits[:3]) or body.matter_title
    role = body.speaker
    phase = body.hearing_phase or "submissions"
    return (
        f"{body.matter_type} Indian law hearing {phase} {role}: {focus}. "
        f"{body.matter_title}"
    )[:400]


def _source_kind_for_doc(doc_id: str, intake_ids: set[str]) -> str:
    if doc_id in intake_ids:
        return "document"
    return "corpus"


def _pack_verified(
    corpus: list[RetrievedSource],
    web: list[dict[str, str]],
    intake_ids: set[str],
) -> list[CourtroomVerifiedSource]:
    out: list[CourtroomVerifiedSource] = []
    for i, src in enumerate(corpus[:6], start=1):
        sid = f"c{i}"
        title = src.title or src.citation or f"Authority {i}"
        cite = src.citation or src.section or title
        snippet = (src.content or "")[:320]
        out.append(
            CourtroomVerifiedSource(
                id=sid,
                title=title,
                citation=cite,
                snippet=snippet,
                sourceKind=_source_kind_for_doc(src.document_id, intake_ids),
                url=None,
                documentId=src.document_id,
                verified=True,
            )
        )
    for i, w in enumerate(web[:4], start=1):
        sid = f"w{i}"
        out.append(
            CourtroomVerifiedSource(
                id=sid,
                title=w.get("title") or f"Web source {i}",
                citation=w.get("url") or w.get("title") or "",
                snippet=(w.get("snippet") or "")[:320],
                sourceKind="web",
                url=w.get("url"),
                documentId=None,
                verified=True,
            )
        )
    return out


def _fallback_turn(
    body: CourtroomTurnRequest,
    verified: list[CourtroomVerifiedSource],
) -> dict[str, Any]:
    open_pts = [a for a in body.agenda if a.status in {"pending", "raised"}]
    point = open_pts[0] if open_pts else None
    cite_ids = [v.id for v in verified[:2]]
    if body.speaker == "judge":
        text = (
            f"Counsel, confine yourselves to the record. "
            f"{'Address specifically: ' + point.label if point else 'Proceed on the framed issues.'}"
        )
        return {
            "speaker": "judge",
            "text": text,
            "textHi": None,
            "addressesPointIds": [point.id] if point else [],
            "citeSourceIds": cite_ids[:1],
            "exhibitActions": [],
            "suggestJudgeIntervene": False,
            "timelineStep": body.hearing_phase or "submissions",
            "judgeState": "questioning",
            "judgeNote": "Testing the record",
        }
    side = "petitioner" if body.speaker == "petitioner" else "respondent"
    verb = "relies on" if side == "petitioner" else "contests"
    text = (
        f"My Lords, the {side} {verb} the pleaded narrative"
        f"{(' — particularly ' + point.label) if point else ''}. "
        f"We invite the Court to weigh the simulation record accordingly."
    )
    return {
        "speaker": body.speaker,
        "text": text,
        "textHi": None,
        "addressesPointIds": [point.id] if point else [],
        "citeSourceIds": cite_ids,
        "exhibitActions": [],
        "suggestJudgeIntervene": False,
        "timelineStep": body.hearing_phase or "submissions",
        "judgeState": None,
        "judgeNote": None,
    }


def _build_user_prompt(
    body: CourtroomTurnRequest,
    verified: list[CourtroomVerifiedSource],
) -> str:
    agenda_lines = "\n".join(
        f"- [{a.id}] ({a.status}) {a.label}" for a in body.agenda
    ) or "(none)"
    uncovered = [
        a for a in body.agenda if a.status in {"pending", "raised"}
    ]
    uncovered_lines = "\n".join(f"- [{a.id}] {a.label}" for a in uncovered) or "(largely contested)"
    sources_block = "\n".join(
        f"- [{v.id}] ({v.source_kind}) {v.title} — {v.citation}\n  snippet: {v.snippet}"
        for v in verified
    ) or "(no external authorities retrieved — argue from case record only)"
    exhibits = "\n".join(
        f"- [{e.id}] {e.title} ({e.status})" for e in body.exhibits
    ) or "(none)"
    return f"""SPEAKER ROLE: {body.speaker}
HEARING PHASE: {body.hearing_phase or "submissions"}
FORCE CLOSING: {body.force_closing}
INTERVENE AS BENCH: {body.intervene}

CASE RECORD:
Cause: {body.matter_title}
Nature: {body.matter_type}
Petitioner counsel: {body.petitioner_name}
Respondent counsel: {body.respondent_name}
Summary: {body.case_summary or "(none)"}
Facts: {(body.facts or "")[:800]}
Issues: {(body.issues or "")[:600]}
Relief: {body.relief_sought or "(as pleaded)"}

EXHIBITS ON RECORD:
{exhibits}

AGENDA:
{agenda_lines}

STILL TO COVER:
{uncovered_lines}

VERIFIED SOURCES (cite only these via citeSourceIds):
{sources_block}

RECENT TRANSCRIPT:
{body.transcript_excerpt or "(matter just called)"}

Persona cue: {body.persona_cue or "(default Indian courtroom manner)"}
Strategy: {body.strategy_cue or "(none)"}

Return ONLY the JSON object for this single utterance.
"""


async def build_courtroom_turn(
    llm: LLMClient,
    retriever: HttpSearchRetriever,
    body: CourtroomTurnRequest,
    *,
    user_token: str | None,
) -> CourtroomTurnResponse:
    intake_ids = set(body.document_ids or [])
    query = _retrieval_query(body)

    filters = SearchFilters(
        document_ids=body.document_ids if body.document_ids else None,
        jurisdiction=body.jurisdiction,
    )
    # Prefer intake docs when present; otherwise search full corpus
    if body.document_ids:
        doc_sources = await retriever.retrieve(
            query,
            top_k=4,
            filters=SearchFilters(document_ids=body.document_ids),
            user_token=user_token,
        )
        corpus_sources = await retriever.retrieve(
            query,
            top_k=4,
            filters=SearchFilters(jurisdiction=body.jurisdiction),
            user_token=user_token,
        )
        # Deduplicate by chunk_id
        seen: set[str] = set()
        corpus: list[RetrievedSource] = []
        for s in doc_sources + corpus_sources:
            if s.chunk_id in seen:
                continue
            seen.add(s.chunk_id)
            corpus.append(s)
    else:
        corpus = await retriever.retrieve(
            query,
            top_k=6,
            filters=filters if not filters.is_empty() else None,
            user_token=user_token,
        )

    web_raw: list[dict[str, str]] = []
    if body.allow_web:
        try:
            web_hits = await search_web_text(f"{query} India law", max_results=4)
            web_raw = [
                {"title": w.title, "url": w.url, "snippet": w.snippet or ""}
                for w in web_hits
            ]
        except Exception:
            web_raw = []

    verified = _pack_verified(corpus, web_raw, intake_ids)
    fallback = _fallback_turn(body, verified)

    parsed = await complete_json(
        llm,
        system=_SYSTEM,
        user=_build_user_prompt(body, verified),
        fallback=fallback,
        temperature=0.35,
    )

    # Normalize citeSourceIds against verified set
    valid_ids = {v.id for v in verified}
    cite_ids = [
        cid
        for cid in (parsed.get("citeSourceIds") or parsed.get("cite_source_ids") or [])
        if isinstance(cid, str) and cid in valid_ids
    ]
    # Map legacy freeform cites if model ignored schema
    if not cite_ids and verified and parsed.get("cites"):
        cite_ids = [verified[0].id]

    text = str(parsed.get("text") or fallback["text"]).strip()
    if not text:
        text = fallback["text"]

    exhibit_actions: list[CourtroomExhibitAction] = []
    for raw in parsed.get("exhibitActions") or parsed.get("exhibit_actions") or []:
        if not isinstance(raw, dict):
            continue
        eid = raw.get("exhibitId") or raw.get("exhibit_id")
        status = raw.get("status")
        if eid and status in {"marked", "admitted", "rejected", "pending"}:
            exhibit_actions.append(
                CourtroomExhibitAction(exhibitId=str(eid), status=str(status))
            )

    return CourtroomTurnResponse(
        speaker=body.speaker,
        text=text,
        text_hi=(str(parsed["textHi"]).strip() if parsed.get("textHi") else None),
        addresses_point_ids=[
            str(x) for x in (parsed.get("addressesPointIds") or parsed.get("addresses_point_ids") or [])
            if x
        ],
        cite_source_ids=cite_ids,
        exhibit_actions=exhibit_actions,
        suggest_judge_intervene=bool(
            parsed.get("suggestJudgeIntervene") or parsed.get("suggest_judge_intervene")
        ),
        timeline_step=parsed.get("timelineStep") or parsed.get("timeline_step") or body.hearing_phase,
        judge_state=parsed.get("judgeState") or parsed.get("judge_state"),
        judge_note=parsed.get("judgeNote") or parsed.get("judge_note"),
        verified_sources=verified,
        disclaimer=(
            "AI courtroom simulation output for educational case-strength analysis only. "
            "Not a court order or legal advice."
        ),
    )


def parse_turn_raw_json(raw: str) -> dict[str, Any] | None:
    match = _JSON_BLOCK_RE.search(raw)
    if not match:
        return None
    try:
        data = json.loads(match.group())
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None
