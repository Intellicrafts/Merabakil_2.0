"""Agentic courtroom turn runner — CourtMaster grants floor; role agent acts."""

from __future__ import annotations

from typing import Any

from app.application.courtroom_agents.agents import court_master_choose_speaker, run_role_agent
from app.application.courtroom_agents.blackboard import (
    HearingBlackboard,
    blackboard_from_payload,
)
from app.application.courtroom_agents.context import (
    append_transcript_turn,
    bootstrap_compress_and_extract,
    update_compressed_context,
)
from app.application.courtroom_agents.tools import ToolBelt
from app.infrastructure.search_retriever import HttpSearchRetriever
from legalos_common.clients.llm import LLMClient

_DISCLAIMER = (
    "AI courtroom simulation — agentic multi-agent hearing for educational "
    "case-strength analysis only. Not a court order or legal advice."
)


def _blackboard_echo(board: HearingBlackboard) -> dict[str, Any]:
    return {
        "turnIndex": board.turn_index,
        "counselTurns": board.counsel_turns,
        "judgeTurns": board.judge_turns,
        "closingsDone": board.closings_done,
        "issuesFramed": board.issues_framed,
        "verdictReady": board.verdict_ready,
        "lastSpeaker": board.last_speaker,
        "derivedPhase": board.derived_phase,
        "agenda": [a.model_dump() for a in board.agenda],
        "exhibits": [e.model_dump() for e in board.exhibits],
        "authorities": [
            {
                "id": a.id,
                "title": a.title,
                "citation": a.citation,
                "snippet": a.snippet,
                "sourceKind": a.source_kind,
                "url": a.url,
                "documentId": a.document_id,
                "verified": a.verified,
            }
            for a in board.authorities
        ],
        "compressedCase": board.compressed_case,
        "extractedFacts": [f.model_dump() for f in board.extracted_facts],
        "runningMemory": board.running_memory,
        "scratchpads": dict(board.scratchpads),
        "transcriptTurns": [t.model_dump() for t in board.transcript_turns],
    }


async def run_agentic_hearing_turn(
    llm: LLMClient,
    retriever: HttpSearchRetriever,
    payload: dict[str, Any],
    *,
    user_token: str | None,
) -> dict[str, Any]:
    board = blackboard_from_payload(payload)
    board.refresh_phase()

    # Bootstrap compressed case + extracted facts once per hearing
    await bootstrap_compress_and_extract(llm, board)

    forced = payload.get("force_speaker") or payload.get("forceSpeaker")
    if forced in {"judge", "petitioner", "respondent"}:
        speaker = forced
    else:
        speaker = await court_master_choose_speaker(llm, board)

    tools = ToolBelt(retriever, user_token=user_token)
    result = await run_role_agent(llm, tools, board, role=speaker)

    # Update counters on blackboard for client echo
    if speaker == "judge":
        board.judge_turns += 1
        if not board.issues_framed and "issue" in (result.get("text") or "").lower():
            board.issues_framed = True
    else:
        board.counsel_turns += 1
        if board.derived_phase == "closing":
            board.closings_done += 1

    board.last_speaker = speaker
    board.turn_index += 1
    board.refresh_phase()

    utterance = str(result.get("text") or "")
    append_transcript_turn(board, speaker, utterance)
    await update_compressed_context(llm, board, speaker=speaker, utterance=utterance)

    # Auto-mark first pending exhibit if counsel spoke during evidence phase and didn't
    if (
        board.derived_phase == "evidence_marking"
        and speaker in {"petitioner", "respondent"}
        and not result.get("exhibitActions")
    ):
        pending = next((e for e in board.exhibits if e.status == "pending"), None)
        if pending:
            board.apply_exhibit_status(pending.id, "marked")
            result.setdefault("exhibitActions", []).append(
                {"exhibitId": pending.id, "status": "marked"}
            )

    verified = result.get("verifiedSources") or []
    normalized_sources = []
    for s in verified:
        if not isinstance(s, dict):
            continue
        normalized_sources.append(
            {
                "id": s.get("id"),
                "title": s.get("title"),
                "citation": s.get("citation") or "",
                "snippet": s.get("snippet") or "",
                "sourceKind": s.get("source_kind") or s.get("sourceKind") or "corpus",
                "url": s.get("url"),
                "documentId": s.get("document_id") or s.get("documentId"),
                "verified": s.get("verified", True),
            }
        )

    return {
        "speaker": speaker,
        "text": result.get("text") or "",
        "textHi": result.get("textHi"),
        "addressesPointIds": result.get("addressesPointIds") or [],
        "citeSourceIds": result.get("citeSourceIds") or [],
        "exhibitActions": result.get("exhibitActions") or [],
        "timelineStep": result.get("timelineStep") or board.derived_phase,
        "judgeState": result.get("judgeState"),
        "judgeNote": result.get("judgeNote"),
        "isVerdict": bool(result.get("isVerdict")),
        "toolTrace": result.get("toolTrace") or tools.trace,
        "verifiedSources": normalized_sources,
        "blackboard": _blackboard_echo(board),
        "disclaimer": _DISCLAIMER,
    }
