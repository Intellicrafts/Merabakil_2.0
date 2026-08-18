"""Post-hearing counsel action plan for AI Courtroom simulations."""

from __future__ import annotations

from typing import Any

from app.api.schemas import (
    CourtroomActionCta,
    CourtroomActionsRequest,
    CourtroomActionsResponse,
    CourtroomMandatoryFact,
    CourtroomOpponentFactDefense,
    CourtroomProposedAction,
    CourtroomResearchAngle,
)
from app.infrastructure.llm_json import complete_json
from legalos_common.clients.llm import LLMClient

_PRIORITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}

_DISCLAIMER = (
    "This action plan is generated from an AI courtroom simulation for educational "
    "case-strength analysis only. It is not a court order or legal advice. Consult a "
    "licensed advocate before filing or acting."
)

_SYSTEM = """You are an Indian litigation counsel preparing a POST-HEARING action plan
after an AI courtroom simulation (educational; not a real court).

Respond ONLY with valid JSON matching this schema:
{
  "headline": "str",
  "summary": "str",
  "forumHint": "str|null",
  "limitationFlags": ["str"],
  "actions": [
    {
      "id": "a1",
      "title": "str",
      "description": "str",
      "side": "petitioner|respondent|both",
      "priority": "critical|high|medium|low",
      "timeframe": "immediate|7d|30d|before_next_listing",
      "category": "evidence|filing|research|settlement|compliance|procedure|defense|fact_proof",
      "rationale": "str",
      "relatedIssueIds": ["pt-1"],
      "cta": {"kind": "research|mera_vakil|copy", "query": "optional search query"}
    }
  ],
  "mandatoryFacts": [
    {
      "id": "mf1",
      "fact": "Concrete fact that MUST be proved on the record",
      "whyMandatory": "Why the Bench / cause of action requires this fact",
      "howToProve": "Documents, witnesses, or admissions to establish it",
      "side": "petitioner|respondent|both",
      "relatedIssueIds": ["pt-1"]
    }
  ],
  "opponentFactDefenses": [
    {
      "id": "od1",
      "opponentFact": "Fact or narrative advanced by the opposite side",
      "defenseStrategy": "How to rebut, distinguish, or neutralize that fact",
      "evidenceNeeded": "What proof undercuts or answers it",
      "side": "petitioner|respondent|both",
      "relatedIssueIds": ["pt-1"]
    }
  ],
  "documentsToGather": ["str"],
  "researchAngles": [{"title": "str", "query": "str"}],
  "settlementLevers": ["str"],
  "disclaimer": "str"
}

Rules:
- Max 10 general actions. ALSO always include 3–6 mandatoryFacts and 3–6 opponentFactDefenses.
- When "Issues NOT fully argued" are listed, prioritize actions that close those gaps.
- Prefer concrete filing / proof / research steps a counsel can execute without re-watching the hearing.
- mandatoryFacts = facts that are essential / must be established for the case to succeed
  (burden of proof, ingredients of cause of action / offence / writ ground).
- opponentFactDefenses = for each strong opposing fact from the hearing, explain HOW to defend
  or rebut it (denial, contradiction, legal irrelevance, better evidence).
- Concrete, prioritized, Indian procedural idioms. Tie to weaknesses / contested agenda /
  oral verdict. Do NOT invent statutes or facts absent from the hearing record.
- Prefer filing, evidence, research, defense, fact_proof, and settlement categories.
- Always include a clear disclaimer.
- Sort actions critical → low.
"""


def _agenda_fact_seeds(body: CourtroomActionsRequest) -> list[str]:
    labels = [a.label for a in body.agenda if a.label.strip()]
    issues = list(body.issues_framed or [])
    seeds = labels[:4] + issues[:3]
    if not seeds:
        seeds = [
            f"Material facts supporting the {body.matter_type} cause of action",
            "Documentary chain linking parties to the dispute",
        ]
    return seeds[:6]


def _fallback_mandatory_facts(body: CourtroomActionsRequest) -> list[dict[str, Any]]:
    seeds = _agenda_fact_seeds(body)
    weakness = (body.weaknesses_exposed or [None])[0]
    facts: list[dict[str, Any]] = []
    for i, seed in enumerate(seeds[:4], start=1):
        facts.append(
            {
                "id": f"mf{i}",
                "fact": seed if seed.endswith(".") else f"{seed}",
                "whyMandatory": (
                    "This point was contested or framed in the hearing and is treated as "
                    "essential to make out / resist the claim on the simulation record."
                ),
                "howToProve": (
                    "Gather dated primary documents, corroborating correspondence, and "
                    "a short witness affidavit or admission on this point."
                ),
                "side": "petitioner" if i % 2 else "both",
                "relatedIssueIds": [a.id for a in body.agenda[:2]],
            }
        )
    if weakness:
        facts.append(
            {
                "id": f"mf{len(facts) + 1}",
                "fact": f"Cure the exposed gap: {weakness}",
                "whyMandatory": "The simulated hearing treated this as a decisive weakness.",
                "howToProve": "Produce the missing exhibit or neutral third-party record that closes the gap.",
                "side": "both",
                "relatedIssueIds": [],
            }
        )
    return facts[:6]


def _fallback_opponent_defenses(body: CourtroomActionsRequest) -> list[dict[str, Any]]:
    weaknesses = body.weaknesses_exposed or []
    contested = [a.label for a in body.agenda if a.status in {"contested", "raised"}]
    opponent_lines = weaknesses[:3] or contested[:3] or [
        "Opposite side's narrative on liability / causation",
        "Claim that documentary proof is incomplete",
        "Assertion that relief sought is disproportionate",
    ]
    out: list[dict[str, Any]] = []
    for i, fact in enumerate(opponent_lines[:5], start=1):
        out.append(
            {
                "id": f"od{i}",
                "opponentFact": fact,
                "defenseStrategy": (
                    f"Do not leave '{fact}' unanswered. Put the opposite party to strict "
                    "proof, highlight contradictions with the pleaded chronology, and "
                    "show why the fact is legally insufficient even if partly true."
                ),
                "evidenceNeeded": (
                    "Contemporaneous documents, prior inconsistent statements, and a "
                    "short comparative chronology annexure."
                ),
                "side": "respondent" if i % 2 == 0 else "petitioner",
                "relatedIssueIds": [a.id for a in body.agenda[:2]],
            }
        )
    return out


def fallback_action_plan(body: CourtroomActionsRequest) -> dict[str, Any]:
    """Deterministic matter-type templates when LLM fails."""
    mt = (body.matter_type or "Civil").strip()
    title = body.matter_title or "the matter"
    gap = (body.not_covered or body.weaknesses_exposed or ["evidentiary gaps on contested issues"])[0]
    weakness = gap
    contested = [a for a in body.agenda if a.status in {"pending", "raised", "contested"}]
    issue_ids = [a.id for a in contested[:3]]
    mandatory = _fallback_mandatory_facts(body)
    defenses = _fallback_opponent_defenses(body)

    base_actions: list[dict[str, Any]] = [
        {
            "id": "a1",
            "title": "Prove the mandatory facts on your side",
            "description": (
                "Prepare a fact matrix: each mandatory fact → exhibit / witness → page reference. "
                f"Start with: {mandatory[0]['fact'] if mandatory else weakness}."
            ),
            "side": "petitioner",
            "priority": "critical",
            "timeframe": "immediate",
            "category": "fact_proof",
            "rationale": "The case turns on facts the Bench treated as essential.",
            "relatedIssueIds": issue_ids,
            "cta": {
                "kind": "mera_vakil",
                "query": f"Mandatory facts to prove in {title} ({mt}) under Indian law",
            },
        },
        {
            "id": "a2",
            "title": "Build defenses to the opponent's key facts",
            "description": (
                "For each opponent fact from the hearing, write a one-line denial/rebuttal "
                f"and attach proof. First target: {defenses[0]['opponentFact'] if defenses else weakness}."
            ),
            "side": "both",
            "priority": "critical",
            "timeframe": "7d",
            "category": "defense",
            "rationale": "Unanswered opponent facts weaken the simulated case posture.",
            "relatedIssueIds": issue_ids,
            "cta": {
                "kind": "research",
                "query": f"How to rebut opposing facts in {mt} matter: {title}",
            },
        },
        {
            "id": "a3",
            "title": "Verify limitation and jurisdictional foundation",
            "description": (
                "Confirm limitation under the Limitation Act, 1963 and territorial/pecuniary "
                "jurisdiction before the next listing or filing."
            ),
            "side": "petitioner",
            "priority": "high",
            "timeframe": "immediate",
            "category": "procedure",
            "rationale": "Limitation and forum must be clear before further steps.",
            "relatedIssueIds": [],
            "cta": {
                "kind": "research",
                "query": f"Limitation period and jurisdiction for {mt} matter: {title}",
            },
        },
    ]

    if mt == "Criminal":
        base_actions.append(
            {
                "id": "a4",
                "title": "Map CrPC remedies and custody / bail posture",
                "description": (
                    "Assess bail, discharge, or quashing options against the hearing record "
                    "and investigation papers."
                ),
                "side": "both",
                "priority": "high",
                "timeframe": "7d",
                "category": "filing",
                "rationale": "Criminal matters require procedural clarity after arguments.",
                "relatedIssueIds": issue_ids,
                "cta": {
                    "kind": "research",
                    "query": f"CrPC remedies after arguments in {title}",
                },
            }
        )
    elif mt == "Constitutional":
        base_actions.append(
            {
                "id": "a4",
                "title": "Refine writ prayer and Article-based grounds",
                "description": (
                    "Align the writ petition grounds with the oral order simulation and "
                    "natural justice / proportionality points raised."
                ),
                "side": "petitioner",
                "priority": "high",
                "timeframe": "7d",
                "category": "filing",
                "rationale": "Writ relief must track framed constitutional issues.",
                "relatedIssueIds": issue_ids,
                "cta": {
                    "kind": "research",
                    "query": f"Writ petition grounds and prayer for {title}",
                },
            }
        )
    elif mt == "Arbitration":
        base_actions.append(
            {
                "id": "a4",
                "title": "Check Arbitration Act interim / challenge path",
                "description": (
                    "Evaluate Section 9 interim measures or Section 34 challenge strategy "
                    "consistent with the simulated disposition."
                ),
                "side": "both",
                "priority": "high",
                "timeframe": "7d",
                "category": "filing",
                "rationale": "Arbitration pathway depends on seat and award posture.",
                "relatedIssueIds": issue_ids,
                "cta": {
                    "kind": "research",
                    "query": f"Arbitration & Conciliation Act next steps for {title}",
                },
            }
        )
    else:
        base_actions.append(
            {
                "id": "a4",
                "title": "Prepare focused written submissions / rejoinder",
                "description": (
                    "Draft concise written arguments pairing each mandatory fact with the "
                    "defense to the corresponding opponent fact."
                ),
                "side": "both",
                "priority": "high",
                "timeframe": "7d",
                "category": "filing",
                "rationale": "Closings revealed points that need written fortification.",
                "relatedIssueIds": issue_ids,
                "cta": {
                    "kind": "mera_vakil",
                    "query": f"Draft structure for written submissions in {title}",
                },
            }
        )

    base_actions.append(
        {
            "id": "a5",
            "title": "Explore settlement leverage from the adversarial exchange",
            "description": (
                "Use mandatory-fact gaps and opponent-fact vulnerabilities to frame a "
                "without-prejudice settlement range."
            ),
            "side": "both",
            "priority": "medium",
            "timeframe": "30d",
            "category": "settlement",
            "rationale": "Simulation highlighted bargaining chips on the record.",
            "relatedIssueIds": [],
            "cta": {
                "kind": "mera_vakil",
                "query": f"Settlement levers after hearing simulation for {title}",
            },
        }
    )

    docs = [
        "Cause title pleadings and vakalatnama",
        "Key contracts / notices / correspondence on record",
        "Chronology of events with supporting exhibits",
        "Fact matrix: mandatory facts ↔ exhibits",
        "Opponent-fact rebuttal annexure",
    ]
    if mt == "Criminal":
        docs = ["FIR / charge-sheet extracts", "Bail papers", "Medical / seizure memos", *docs[:3]]

    return {
        "headline": f"Post-hearing action plan — {title}",
        "summary": (
            f"On the simulated {mt} hearing record, lock the mandatory facts you must prove, "
            "prepare defenses to the opponent's facts, then file/evidence accordingly."
        ),
        "forumHint": body.disposition or None,
        "limitationFlags": [
            "Verify limitation under the Limitation Act, 1963",
            "Confirm when the cause of action accrued",
        ],
        "actions": base_actions,
        "mandatoryFacts": mandatory,
        "opponentFactDefenses": defenses,
        "documentsToGather": docs,
        "researchAngles": [
            {
                "title": f"{mt} standards applicable to the dispute",
                "query": f"Key Indian legal standards for {mt} dispute: {title}",
            },
            {
                "title": "Mandatory facts & burden of proof",
                "query": f"What facts must be proved in {title} ({mt})?",
            },
            {
                "title": "Defending opponent facts",
                "query": f"How to rebut opposing case theory in {title}",
            },
        ],
        "settlementLevers": [
            "Trade interim protection for timelines on document production",
            "Narrow issues for consent terms based on contested agenda points",
        ],
        "disclaimer": _DISCLAIMER,
    }


def _normalize_action(raw: dict[str, Any], index: int) -> CourtroomProposedAction:
    priority = str(raw.get("priority", "medium")).lower()
    if priority not in _PRIORITY_ORDER:
        priority = "medium"
    timeframe = str(raw.get("timeframe", "7d"))
    if timeframe not in {"immediate", "7d", "30d", "before_next_listing"}:
        timeframe = "7d"
    category = str(raw.get("category", "procedure"))
    if category not in {
        "evidence",
        "filing",
        "research",
        "settlement",
        "compliance",
        "procedure",
        "defense",
        "fact_proof",
    }:
        category = "procedure"
    side = str(raw.get("side", "both")).lower()
    if side not in {"petitioner", "respondent", "both"}:
        side = "both"

    cta_raw = raw.get("cta")
    cta: CourtroomActionCta | None = None
    if isinstance(cta_raw, dict):
        kind = str(cta_raw.get("kind", "copy"))
        if kind not in {"research", "mera_vakil", "copy"}:
            kind = "copy"
        query = cta_raw.get("query")
        cta = CourtroomActionCta(kind=kind, query=str(query) if query else None)

    related = raw.get("relatedIssueIds") or raw.get("related_issue_ids") or []
    return CourtroomProposedAction(
        id=str(raw.get("id") or f"a{index + 1}"),
        title=str(raw.get("title") or "Follow-up action").strip()[:200],
        description=str(raw.get("description") or "").strip()[:1200],
        side=side,  # type: ignore[arg-type]
        priority=priority,  # type: ignore[arg-type]
        timeframe=timeframe,  # type: ignore[arg-type]
        category=category,  # type: ignore[arg-type]
        rationale=str(raw.get("rationale") or "").strip()[:500],
        related_issue_ids=[str(x) for x in related][:8],
        cta=cta,
    )


def _normalize_mandatory_fact(raw: dict[str, Any], index: int) -> CourtroomMandatoryFact:
    side = str(raw.get("side", "petitioner")).lower()
    if side not in {"petitioner", "respondent", "both"}:
        side = "petitioner"
    related = raw.get("relatedIssueIds") or raw.get("related_issue_ids") or []
    return CourtroomMandatoryFact(
        id=str(raw.get("id") or f"mf{index + 1}"),
        fact=str(raw.get("fact") or "").strip()[:400],
        why_mandatory=str(raw.get("whyMandatory") or raw.get("why_mandatory") or "").strip()[:500],
        how_to_prove=str(raw.get("howToProve") or raw.get("how_to_prove") or "").strip()[:600],
        side=side,
        related_issue_ids=[str(x) for x in related][:8],
    )


def _normalize_opponent_defense(
    raw: dict[str, Any], index: int
) -> CourtroomOpponentFactDefense:
    side = str(raw.get("side", "petitioner")).lower()
    if side not in {"petitioner", "respondent", "both"}:
        side = "petitioner"
    related = raw.get("relatedIssueIds") or raw.get("related_issue_ids") or []
    return CourtroomOpponentFactDefense(
        id=str(raw.get("id") or f"od{index + 1}"),
        opponent_fact=str(
            raw.get("opponentFact") or raw.get("opponent_fact") or ""
        ).strip()[:400],
        defense_strategy=str(
            raw.get("defenseStrategy") or raw.get("defense_strategy") or ""
        ).strip()[:800],
        evidence_needed=str(
            raw.get("evidenceNeeded") or raw.get("evidence_needed") or ""
        ).strip()[:600],
        side=side,
        related_issue_ids=[str(x) for x in related][:8],
    )


def _to_response(data: dict[str, Any], fallback: dict[str, Any]) -> CourtroomActionsResponse:
    actions_raw = data.get("actions")
    if not isinstance(actions_raw, list) or not actions_raw:
        actions_raw = fallback["actions"]

    actions = [_normalize_action(a, i) for i, a in enumerate(actions_raw) if isinstance(a, dict)]
    actions = actions[:10]
    actions.sort(key=lambda a: _PRIORITY_ORDER.get(a.priority, 9))

    mf_raw = data.get("mandatoryFacts") or data.get("mandatory_facts") or fallback.get(
        "mandatoryFacts", []
    )
    if not isinstance(mf_raw, list) or not mf_raw:
        mf_raw = fallback.get("mandatoryFacts", [])
    mandatory = [
        _normalize_mandatory_fact(m, i)
        for i, m in enumerate(mf_raw)
        if isinstance(m, dict) and (m.get("fact") or "").strip()
    ][:8]

    od_raw = data.get("opponentFactDefenses") or data.get("opponent_fact_defenses") or fallback.get(
        "opponentFactDefenses", []
    )
    if not isinstance(od_raw, list) or not od_raw:
        od_raw = fallback.get("opponentFactDefenses", [])
    defenses = [
        _normalize_opponent_defense(d, i)
        for i, d in enumerate(od_raw)
        if isinstance(d, dict)
        and (d.get("opponentFact") or d.get("opponent_fact") or "").strip()
    ][:8]

    angles_raw = data.get("researchAngles") or data.get("research_angles") or fallback["researchAngles"]
    angles: list[CourtroomResearchAngle] = []
    if isinstance(angles_raw, list):
        for item in angles_raw[:6]:
            if isinstance(item, dict) and item.get("title") and item.get("query"):
                angles.append(
                    CourtroomResearchAngle(title=str(item["title"])[:200], query=str(item["query"])[:500])
                )

    def _str_list(key_camel: str, key_snake: str, default: list[str]) -> list[str]:
        raw = data.get(key_camel) or data.get(key_snake) or default
        if not isinstance(raw, list):
            return default
        return [str(x).strip() for x in raw if str(x).strip()][:12]

    return CourtroomActionsResponse(
        headline=str(data.get("headline") or fallback["headline"])[:240],
        summary=str(data.get("summary") or fallback["summary"])[:1200],
        forum_hint=(
            str(data["forumHint"]).strip()
            if data.get("forumHint")
            else (str(data["forum_hint"]).strip() if data.get("forum_hint") else None)
        )
        or None,
        limitation_flags=_str_list("limitationFlags", "limitation_flags", fallback["limitationFlags"]),
        actions=actions,
        mandatory_facts=mandatory
        or [
            _normalize_mandatory_fact(m, i)
            for i, m in enumerate(fallback.get("mandatoryFacts", []))
            if isinstance(m, dict)
        ],
        opponent_fact_defenses=defenses
        or [
            _normalize_opponent_defense(d, i)
            for i, d in enumerate(fallback.get("opponentFactDefenses", []))
            if isinstance(d, dict)
        ],
        documents_to_gather=_str_list(
            "documentsToGather", "documents_to_gather", fallback["documentsToGather"]
        ),
        research_angles=angles
        or [
            CourtroomResearchAngle(title=a["title"], query=a["query"])
            for a in fallback["researchAngles"]
        ],
        settlement_levers=_str_list(
            "settlementLevers", "settlement_levers", fallback["settlementLevers"]
        ),
        disclaimer=str(data.get("disclaimer") or _DISCLAIMER),
    )


def _user_payload(body: CourtroomActionsRequest) -> str:
    agenda_lines = "\n".join(
        f"- [{a.id}] ({a.status}) {a.label}" for a in body.agenda[:12]
    ) or "(none)"
    weaknesses = "\n".join(f"- {w}" for w in (body.weaknesses_exposed or [])[:8]) or "(none listed)"
    issues = "\n".join(f"- {i}" for i in (body.issues_framed or [])[:8]) or "(none)"
    not_covered = "\n".join(f"- {n}" for n in (body.not_covered or [])[:12]) or "(none listed)"
    cite_note = ""
    if body.verified_cite_count is not None or body.unverified_cite_count is not None:
        cite_note = (
            f"Authorities quality: verified={body.verified_cite_count or 0}, "
            f"unverified={body.unverified_cite_count or 0}\n"
        )
    return (
        f"Matter: {body.matter_title}\n"
        f"Type: {body.matter_type}\n"
        f"Petitioner counsel: {body.petitioner_name}\n"
        f"Respondent counsel: {body.respondent_name}\n"
        f"Oral verdict:\n{body.oral_verdict or '(not captured)'}\n"
        f"Disposition / operative portion:\n{body.disposition or '(not captured)'}\n"
        f"Coverage: {body.coverage_summary or '(n/a)'}\n"
        f"Issues NOT fully argued (honest gaps — prioritize these):\n{not_covered}\n"
        f"{cite_note}"
        f"Issues framed:\n{issues}\n"
        f"Weaknesses exposed:\n{weaknesses}\n"
        f"Agenda:\n{agenda_lines}\n"
        f"Transcript excerpt:\n{(body.transcript_excerpt or '')[:6000]}\n"
    )


async def build_courtroom_actions(
    llm: LLMClient,
    body: CourtroomActionsRequest,
) -> CourtroomActionsResponse:
    fallback = fallback_action_plan(body)
    try:
        data = await complete_json(
            llm,
            system=_SYSTEM,
            user=_user_payload(body),
            fallback=fallback,
            temperature=0.25,
        )
    except Exception:
        data = fallback
    return _to_response(data, fallback)
