"""Courtroom role agents — tool-calling ReAct loop on the shared LLMClient."""

from __future__ import annotations

import json
import re
from typing import Any

from app.application.courtroom_agents.blackboard import HearingBlackboard
from app.application.courtroom_agents.context import (
    cap_tool_observation,
    pack_for_court_master,
    pack_for_role,
)
from app.application.courtroom_agents.tools import ToolBelt, tool_specs_for_role
from legalos_common.clients.llm import ChatMessage, LLMClient

_JSON_RE = re.compile(r"\{[\s\S]*\}")
MAX_TOOL_ROUNDS = 2

ROLE_LABEL = {
    "judge": "Hon'ble Presiding Judge",
    "petitioner": "Counsel for the Petitioner",
    "respondent": "Counsel for the Respondent",
}


def _parse_json(raw: str) -> dict[str, Any] | None:
    match = _JSON_RE.search(raw)
    if not match:
        return None
    try:
        data = json.loads(match.group())
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


async def court_master_choose_speaker(
    llm: LLMClient,
    board: HearingBlackboard,
) -> str:
    """Orchestrator agent: grants the floor from blackboard state (not a fixed workflow)."""
    board.refresh_phase()

    # Hard safety rails — still agentic choice within rails / LLM override
    if board.force_end or board.verdict_ready or board.closings_done >= 2:
        return "judge"
    if not board.issues_framed and board.last_speaker != "judge":
        # Prefer bench to frame once; LLM may still override below if issues already implied
        heuristic = "judge"
    elif board.last_speaker == "judge":
        heuristic = "petitioner" if board.counsel_turns % 2 == 0 else "respondent"
    elif board.last_speaker == "petitioner":
        heuristic = "respondent"
    elif board.last_speaker == "respondent":
        # Occasional bench after both sides, else continue petitioner
        heuristic = "judge" if board.counsel_turns > 0 and board.counsel_turns % 4 == 0 else "petitioner"
    else:
        heuristic = "petitioner"

    if board.derived_phase == "closing":
        if board.closings_done == 0:
            heuristic = "petitioner"
        elif board.closings_done == 1:
            heuristic = "respondent"
        else:
            heuristic = "judge"

    system = """You are CourtMasterAgent for an AI simulation of an Indian court hearing.
Pick ONLY who speaks next. Respond with JSON: {"speaker":"judge"|"petitioner"|"respondent","reason":"short"}
Rules:
- Do not stack judge after judge unless pronouncing verdict.
- After issues are framed, prefer alternating counsel.
- Prefer judge when issues not framed, or when closings done and oral order is due.
- Prefer petitioner to open submissions/reply/closing.
This is educational simulation — not a real court."""

    user = (
        f"{pack_for_court_master(board)}\n"
        f"Heuristic suggestion (you may override if justified): {heuristic}\n"
        "Return JSON only."
    )
    try:
        raw = await llm.complete(
            [ChatMessage(role="system", content=system), ChatMessage(role="user", content=user)],
            temperature=0.1,
        )
        parsed = _parse_json(raw) or {}
        speaker = str(parsed.get("speaker") or heuristic).lower()
        if speaker not in {"judge", "petitioner", "respondent"}:
            return heuristic
        # Never stack judges except verdict path
        if speaker == "judge" and board.last_speaker == "judge" and not (
            board.force_end or board.closings_done >= 2 or board.verdict_ready
        ):
            return heuristic if heuristic != "judge" else "petitioner"
        return speaker
    except Exception:
        return heuristic


async def run_role_agent(
    llm: LLMClient,
    tools: ToolBelt,
    board: HearingBlackboard,
    *,
    role: str,
) -> dict[str, Any]:
    """Active role agent: chooses tools (max 2 rounds) then utters."""
    board.refresh_phase()
    allow_web = board.derived_phase in {"submissions", "reply", "closing"}
    specs = tool_specs_for_role(role, allow_web=allow_web)
    tools_blob = "\n".join(f"- {t['name']}: {t['description']}" for t in specs)
    persona = board.persona_cues.get(role, "")
    strategy = board.strategy_cues.get(role, "")

    system = f"""You are {ROLE_LABEL.get(role, role)} in an AI SIMULATION of an Indian court hearing
(educational case-strength analysis — NOT a real court; not legal advice).
Persona: {persona or "Indian courtroom manner"}
Strategy: {strategy or "(none)"}

You may CALL TOOLS or UTTER. Prefer tools only when they improve grounding (search before citing).
Max {MAX_TOOL_ROUNDS} tool calls before you must utter.

When calling a tool, respond ONLY with JSON:
{{"action":"tool","tool":"search_corpus","args":{{"query":"..."}}}}

When speaking, respond ONLY with JSON:
{{
  "action":"utter",
  "text":"2-6 sentence courtroom utterance",
  "textHi":"optional Hindi companion",
  "addressesPointIds":["pt-1"],
  "citeSourceIds":["c1"],
  "exhibitActions":[{{"exhibitId":"ex-1","status":"marked"}}],
  "timelineStep":"{board.derived_phase}",
  "judgeState":"listening|questioning|ruling|deliberating",
  "judgeNote":"optional",
  "isVerdict": false
}}

INDIAN COURTROOM RULES:
- Advocates address "My Lords"; Bench addresses "Counsel".
- Cite only authorities retrieved via tools / on the blackboard.
- Cite only marked/admitted exhibits.
- One utterance only when action=utter.
"""

    observations: list[str] = []
    cite_ids: list[str] = []
    exhibit_actions: list[dict[str, str]] = []
    addresses: list[str] = []
    is_verdict = False

    for round_i in range(MAX_TOOL_ROUNDS + 1):
        force_utter = round_i >= MAX_TOOL_ROUNDS
        user = (
            f"{pack_for_role(board, role, observations)}\n"
            f"AVAILABLE TOOLS:\n{tools_blob}\n\n"
            f"{'You MUST utter now (no more tools).' if force_utter else 'Call a tool OR utter.'}\n"
            "JSON only."
        )
        raw = await llm.complete(
            [ChatMessage(role="system", content=system), ChatMessage(role="user", content=user)],
            temperature=0.35,
        )
        parsed = _parse_json(raw) or {}
        action = str(parsed.get("action") or "").lower()

        if action == "tool" and not force_utter:
            tool_name = str(parsed.get("tool") or "")
            args = parsed.get("args") if isinstance(parsed.get("args"), dict) else {}
            # Tag speaker for agenda tool
            if tool_name == "address_agenda":
                args = {**args, "speaker": role}
            result = await tools.run(
                tool_name, board, args, role=role, allow_web=allow_web
            )
            observations.append(cap_tool_observation(tool_name, result))
            if tool_name == "pronounce_verdict" and result.get("ok"):
                is_verdict = True
            if tool_name == "frame_issues" and result.get("ok"):
                board.issues_framed = True
            continue

        # Utter (or treat malformed as utter text)
        text = str(parsed.get("text") or "").strip()
        if not text:
            text = _fallback_utterance(role, board, is_verdict)
        addresses = [str(x) for x in (parsed.get("addressesPointIds") or []) if x]
        cite_ids = [str(x) for x in (parsed.get("citeSourceIds") or []) if x]
        for raw_ex in parsed.get("exhibitActions") or []:
            if isinstance(raw_ex, dict) and raw_ex.get("exhibitId") and raw_ex.get("status"):
                exhibit_actions.append(
                    {
                        "exhibitId": str(raw_ex["exhibitId"]),
                        "status": str(raw_ex["status"]),
                    }
                )
                board.apply_exhibit_status(str(raw_ex["exhibitId"]), str(raw_ex["status"]))
        if addresses:
            board.apply_agenda_status(addresses, role)
        if parsed.get("isVerdict") or is_verdict:
            is_verdict = True
            board.verdict_ready = True

        return {
            "speaker": role,
            "text": text,
            "textHi": (str(parsed["textHi"]).strip() if parsed.get("textHi") else None),
            "addressesPointIds": addresses,
            "citeSourceIds": cite_ids,
            "exhibitActions": exhibit_actions,
            "timelineStep": parsed.get("timelineStep") or board.derived_phase,
            "judgeState": parsed.get("judgeState"),
            "judgeNote": parsed.get("judgeNote"),
            "isVerdict": is_verdict,
            "toolTrace": tools.trace,
            "verifiedSources": [
                a.model_dump(by_alias=True)
                if hasattr(a, "model_dump")
                else a
                for a in board.authorities
                if not cite_ids or a.id in cite_ids
            ],
        }

    # Should not reach
    return {
        "speaker": role,
        "text": _fallback_utterance(role, board, False),
        "textHi": None,
        "addressesPointIds": [],
        "citeSourceIds": [],
        "exhibitActions": [],
        "timelineStep": board.derived_phase,
        "judgeState": "questioning" if role == "judge" else None,
        "judgeNote": None,
        "isVerdict": False,
        "toolTrace": tools.trace,
        "verifiedSources": [],
    }


def _fallback_utterance(role: str, board: HearingBlackboard, is_verdict: bool) -> str:
    open_pt = board.uncovered()[0] if board.uncovered() else None
    if role == "judge":
        if is_verdict or board.closings_done >= 2:
            return (
                "We have heard learned counsel for both sides. On the simulation record, "
                "the petition is disposed of with liberty to strengthen documentary proof. "
                "Ordered accordingly."
            )
        if not board.issues_framed:
            labels = "; ".join(a.label for a in board.agenda[:4]) or "as arising from the pleadings"
            return (
                f"Issues are framed for consideration: {labels}. "
                "Counsel shall confine arguments to these issues and the prayer."
            )
        return (
            f"Counsel, confine yourselves to the record"
            f"{': ' + open_pt.label if open_pt else '.'}"
        )
    side = "petitioner" if role == "petitioner" else "respondent"
    verb = "relies on" if side == "petitioner" else "contests"
    return (
        f"My Lords, the {side} {verb} the pleaded narrative"
        f"{(' — particularly ' + open_pt.label) if open_pt else ''}. "
        "We invite the Court to weigh the simulation record accordingly."
    )
