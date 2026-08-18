"""Role-scoped context packing + whole-context compress / fact extraction."""

from __future__ import annotations

import json
import re
from typing import Any

from app.application.courtroom_agents.blackboard import (
    ExtractedFact,
    HearingBlackboard,
    TranscriptTurn,
)
from legalos_common.clients.llm import ChatMessage, LLMClient

_JSON_RE = re.compile(r"\{[\s\S]*\}")

# Char budgets ≈ token budgets * 4
BUDGET_COMPRESSED_CASE = 2000
BUDGET_RUNNING_MEMORY = 1000
BUDGET_FACTS_BLOCK = 1600
BUDGET_TRANSCRIPT = 1400
BUDGET_TOOL_OBS = 1000
BUDGET_SCRATCHPAD = 600
BUDGET_WORKING = 1600
MAX_FACTS = 12
MAX_TRANSCRIPT_TURNS_KEEP = 12
RECENT_TURNS_IN_PACK = 3


def truncate(text: str, n: int) -> str:
    text = (text or "").strip()
    if len(text) <= n:
        return text
    return text[: max(0, n - 1)].rstrip() + "…"


def _parse_json(raw: str) -> dict[str, Any] | None:
    match = _JSON_RE.search(raw)
    if not match:
        return None
    try:
        data = json.loads(match.group())
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _split_fact_lines(blob: str) -> list[str]:
    lines: list[str] = []
    for chunk in re.split(r"[\n;•]+", blob or ""):
        line = re.sub(r"^\s*[-*\d.)]+\s*", "", chunk).strip()
        if len(line) >= 12:
            lines.append(line)
    return lines


def heuristic_bootstrap(board: HearingBlackboard) -> None:
    """Compress intake + extract facts without an LLM (stub / fallback)."""
    parts = [
        f"{board.petitioner_name} v {board.respondent_name}",
        f"Matter: {board.matter_title} ({board.matter_type})",
    ]
    if board.case_summary:
        parts.append(f"Cause: {truncate(board.case_summary, 280)}")
    if board.issues:
        parts.append(f"Issues: {truncate(board.issues, 220)}")
    if board.relief_sought:
        parts.append(f"Prayer: {truncate(board.relief_sought, 160)}")
    board.compressed_case = truncate(" | ".join(parts), BUDGET_COMPRESSED_CASE)

    facts: list[ExtractedFact] = []
    for i, line in enumerate(_split_fact_lines(board.facts)[:MAX_FACTS]):
        side = "petitioner"
        low = line.lower()
        if any(k in low for k in ("respondent", "defendant", "denies", "deny")):
            side = "respondent"
        facts.append(
            ExtractedFact(
                id=f"f{i + 1}",
                text=truncate(line, 220),
                side=side,
                status="asserted",
                source="intake",
            )
        )
    if not facts and board.case_summary:
        facts.append(
            ExtractedFact(
                id="f1",
                text=truncate(board.case_summary, 220),
                side="petitioner",
                status="asserted",
                source="intake",
            )
        )
    board.extracted_facts = facts
    board.running_memory = "Hearing called; pleadings compressed. Oral hearing yet to unfold."


def heuristic_update(board: HearingBlackboard, speaker: str, utterance: str) -> None:
    """Append a compressed memory line; leave facts mostly unchanged."""
    line = truncate(f"{speaker}: {utterance}", 180)
    prior = board.running_memory.strip()
    merged = f"{prior} | {line}" if prior else line
    board.running_memory = truncate(merged, BUDGET_RUNNING_MEMORY)

    low = utterance.lower()
    # Light status flips without LLM
    for fact in board.extracted_facts:
        snippet = fact.text[:40].lower()
        if snippet and snippet in low:
            if any(w in low for w in ("admit", "concede", "does not dispute")):
                fact.status = "admitted"
            elif any(w in low for w in ("deny", "dispute", "false", "incorrect")):
                fact.status = "disputed"

    pad = board.scratchpads.get(speaker, "")
    board.scratchpads[speaker] = truncate(
        f"{pad} | next: respond to latest point".strip(" |"),
        BUDGET_SCRATCHPAD,
    )


def _normalize_facts(raw: list[Any], *, default_source: str) -> list[ExtractedFact]:
    out: list[ExtractedFact] = []
    for i, item in enumerate(raw[:MAX_FACTS]):
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or "").strip()
        if not text:
            continue
        status = str(item.get("status") or "asserted").lower()
        if status not in {"asserted", "admitted", "disputed", "proved"}:
            status = "asserted"
        side = str(item.get("side") or "neutral").lower()
        if side not in {"petitioner", "respondent", "neutral", "court"}:
            side = "neutral"
        out.append(
            ExtractedFact(
                id=str(item.get("id") or f"f{i + 1}"),
                text=truncate(text, 220),
                side=side,
                status=status,
                source=str(item.get("source") or default_source)[:40],
            )
        )
    return out


async def bootstrap_compress_and_extract(llm: LLMClient, board: HearingBlackboard) -> None:
    if board.compressed_case and board.extracted_facts:
        return
    system = """You compress Indian court case intake for an AI hearing simulation.
Return JSON only:
{
  "compressedCase": "≤80 words: parties, cause, prayer, decisive points",
  "extractedFacts": [
    {"id":"f1","text":"...","side":"petitioner|respondent|neutral","status":"asserted","source":"intake"}
  ]
}
Extract 5–12 material facts. No legal advice. Educational simulation only."""
    user = (
        f"Matter: {board.matter_title} ({board.matter_type})\n"
        f"P: {board.petitioner_name} | R: {board.respondent_name}\n"
        f"Summary: {truncate(board.case_summary, 800)}\n"
        f"Facts: {truncate(board.facts, 2000)}\n"
        f"Issues: {truncate(board.issues, 600)}\n"
        f"Relief: {truncate(board.relief_sought, 400)}\n"
    )
    try:
        raw = await llm.complete(
            [ChatMessage(role="system", content=system), ChatMessage(role="user", content=user)],
            temperature=0.1,
        )
        parsed = _parse_json(raw) or {}
        compressed = str(parsed.get("compressedCase") or parsed.get("compressed_case") or "").strip()
        facts_raw = parsed.get("extractedFacts") or parsed.get("extracted_facts") or []
        facts = _normalize_facts(facts_raw if isinstance(facts_raw, list) else [], default_source="intake")
        if compressed and facts:
            board.compressed_case = truncate(compressed, BUDGET_COMPRESSED_CASE)
            board.extracted_facts = facts
            board.running_memory = "Hearing called; case compressed from intake."
            return
    except Exception:
        pass
    heuristic_bootstrap(board)


async def update_compressed_context(
    llm: LLMClient,
    board: HearingBlackboard,
    *,
    speaker: str,
    utterance: str,
) -> None:
    system = """You maintain a compressed hearing state for an AI Indian court simulation.
Merge prior state with the new utterance. Return JSON only:
{
  "compressedCase": "rewritten ≤80 word case card (not a chat log)",
  "extractedFacts": [same schema; upsert/status-flip as needed; max 12],
  "runningMemory": "≤60 words what happened so far in the hearing",
  "scratchpad": "optional ≤25 words next focus for the speaker"
}
Statuses: asserted|admitted|disputed|proved. Educational simulation only."""
    facts_blob = "\n".join(
        f"- [{f.id}] ({f.side}/{f.status}) {f.text}" for f in board.extracted_facts
    ) or "(none)"
    user = (
        f"PRIOR CASE:\n{board.compressed_case or '(empty)'}\n\n"
        f"PRIOR FACTS:\n{facts_blob}\n\n"
        f"PRIOR MEMORY:\n{board.running_memory or '(empty)'}\n\n"
        f"NEW UTTERANCE ({speaker}):\n{truncate(utterance, 600)}\n"
    )
    try:
        raw = await llm.complete(
            [ChatMessage(role="system", content=system), ChatMessage(role="user", content=user)],
            temperature=0.1,
        )
        parsed = _parse_json(raw) or {}
        compressed = str(parsed.get("compressedCase") or parsed.get("compressed_case") or "").strip()
        memory = str(parsed.get("runningMemory") or parsed.get("running_memory") or "").strip()
        facts_raw = parsed.get("extractedFacts") or parsed.get("extracted_facts") or []
        facts = _normalize_facts(facts_raw if isinstance(facts_raw, list) else [], default_source="hearing")
        if compressed:
            board.compressed_case = truncate(compressed, BUDGET_COMPRESSED_CASE)
        if memory:
            board.running_memory = truncate(memory, BUDGET_RUNNING_MEMORY)
        if facts:
            # Prefer LLM facts but keep ids stable where possible
            board.extracted_facts = facts
        scratch = str(parsed.get("scratchpad") or "").strip()
        if scratch:
            board.scratchpads[speaker] = truncate(scratch, BUDGET_SCRATCHPAD)
        if compressed or memory or facts:
            return
    except Exception:
        pass
    heuristic_update(board, speaker, utterance)


def append_transcript_turn(board: HearingBlackboard, role: str, text: str) -> None:
    board.transcript_turns.append(TranscriptTurn(role=role, text=truncate(text, 500)))
    if len(board.transcript_turns) > MAX_TRANSCRIPT_TURNS_KEEP:
        board.transcript_turns = board.transcript_turns[-MAX_TRANSCRIPT_TURNS_KEEP:]
    # Keep legacy excerpt in sync for debug
    board.transcript_excerpt = "\n".join(
        f"{t.role}: {t.text}" for t in board.transcript_turns[-10:]
    )


def _format_facts(facts: list[ExtractedFact], *, prefer_open: bool = False) -> str:
    items = facts
    if prefer_open:
        open_f = [f for f in facts if f.status in {"asserted", "disputed"}]
        items = (open_f or facts)[:5]
    if not items:
        return "(no extracted facts)"
    return "\n".join(f"- [{f.id}] ({f.side}/{f.status}) {f.text}" for f in items)


def _format_recent_turns(board: HearingBlackboard, n: int = RECENT_TURNS_IN_PACK) -> str:
    turns = board.transcript_turns[-n:]
    if not turns and board.transcript_excerpt:
        return truncate(board.transcript_excerpt, BUDGET_TRANSCRIPT)
    if not turns:
        return "(matter just called)"
    return truncate(
        "\n".join(f"{t.role}: {t.text}" for t in turns),
        BUDGET_TRANSCRIPT,
    )


def _working_set(board: HearingBlackboard, role: str) -> str:
    uncovered = board.uncovered()
    agenda = "\n".join(f"- [{a.id}] ({a.status}) {a.label}" for a in uncovered[:6]) or "(agenda largely contested)"
    exhibits = [
        e for e in board.exhibits if e.status in {"pending", "marked", "admitted"}
    ][:6]
    ex_lines = "\n".join(f"- [{e.id}] {e.title} ({e.status})" for e in exhibits) or "(none)"
    auths = board.authorities[-5:]
    auth_lines = (
        "\n".join(f"- [{a.id}] {a.title}" for a in auths) or "(none yet — use tools)"
    )
    return truncate(
        f"OPEN AGENDA:\n{agenda}\nEXHIBITS:\n{ex_lines}\nAUTHORITIES:\n{auth_lines}",
        BUDGET_WORKING,
    )


def pack_for_court_master(board: HearingBlackboard) -> str:
    board.refresh_phase()
    open_facts = _format_facts(board.extracted_facts, prefer_open=True)
    uncovered = "\n".join(f"- [{a.id}] {a.label}" for a in board.uncovered()[:5]) or "(none open)"
    return (
        f"Phase hint: {board.derived_phase}\n"
        f"Counters: turn={board.turn_index} counsel={board.counsel_turns} "
        f"judge={board.judge_turns} closings={board.closings_done} "
        f"issues_framed={board.issues_framed} coverage={board.coverage_pct()}%\n"
        f"Last speaker: {board.last_speaker or '(none)'}\n"
        f"OPEN AGENDA:\n{uncovered}\n"
        f"OPEN/DISPUTED FACTS:\n{open_facts}\n"
        f"MEMORY:\n{truncate(board.running_memory, 400)}\n"
    )


def pack_for_role(
    board: HearingBlackboard,
    role: str,
    tool_obs: list[str] | None = None,
) -> str:
    board.refresh_phase()
    # Role-relevant facts: own side + disputed + court
    facts = [
        f
        for f in board.extracted_facts
        if f.side in {role, "neutral", "court"} or f.status in {"disputed", "admitted", "proved"}
    ]
    if not facts:
        facts = board.extracted_facts
    facts_block = truncate(_format_facts(facts[:10]), BUDGET_FACTS_BLOCK)
    scratch = truncate(board.scratchpads.get(role, "") or "(none)", BUDGET_SCRATCHPAD)
    obs = tool_obs or []
    capped_obs = [truncate(o, 200) for o in obs[-4:]]
    obs_block = truncate(
        "\n".join(capped_obs) if capped_obs else "(none)",
        BUDGET_TOOL_OBS,
    )
    return (
        f"COMPRESSED CASE:\n{truncate(board.compressed_case or board.case_summary, BUDGET_COMPRESSED_CASE)}\n\n"
        f"EXTRACTED FACTS:\n{facts_block}\n\n"
        f"RUNNING MEMORY:\n{truncate(board.running_memory, BUDGET_RUNNING_MEMORY)}\n\n"
        f"{_working_set(board, role)}\n\n"
        f"RECENT TURNS:\n{_format_recent_turns(board)}\n\n"
        f"YOUR SCRATCHPAD:\n{scratch}\n\n"
        f"TOOL OBSERVATIONS:\n{obs_block}\n"
        f"Phase: {board.derived_phase} | coverage={board.coverage_pct()}%\n"
    )


def cap_tool_observation(tool_name: str, result: dict[str, Any]) -> str:
    """Compact tool result for re-injection into the role prompt."""
    if tool_name in {"search_corpus", "search_web"}:
        sources = result.get("sources") or []
        bits = []
        for s in sources[:4]:
            if not isinstance(s, dict):
                continue
            bits.append(
                f"{s.get('id')}:{truncate(str(s.get('title') or ''), 60)}"
                f" — {truncate(str(s.get('snippet') or ''), 100)}"
            )
        return f"{tool_name} => " + ("; ".join(bits) or str(result.get("ok")))
    return f"{tool_name} => {truncate(json.dumps(result, default=str), 280)}"
