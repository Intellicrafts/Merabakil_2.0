"""Intent detection agent (keyword-driven, deterministic, offline-safe)."""

from __future__ import annotations

import re

from legalos_orchestrator.agents.base import Agent
from legalos_orchestrator.schemas import Intent, IntentResult, OrchestratorState

_INTENT_KEYWORDS: dict[Intent, tuple[str, ...]] = {
    Intent.CONTRACT_REVIEW: (
        "review this contract", "clause", "agreement review", "nda", "indemnity",
    ),
    Intent.DRAFTING: ("draft", "prepare a notice", "write a petition", "legal notice", "template"),
    Intent.LITIGATION: (
        "file a case", "court procedure", "litigation", "appeal", "jurisdiction to file",
    ),
    Intent.COMPLIANCE: ("rbi", "sebi", "gst", "dpdp", "compliance", "mca", "labour law"),
    Intent.LAWYER_MATCHING: ("find a lawyer", "advocate near", "hire a lawyer", "consult a lawyer"),
    Intent.EVIDENCE_ANALYSIS: ("evidence", "admissibility", "witness statement", "exhibit"),
    Intent.LEGAL_ADVICE: ("what should i do", "is it legal", "can i", "am i liable", "my rights"),
}


class IntentAgent(Agent):
    name = "intent_agent"

    async def run(self, state: OrchestratorState) -> dict:
        text = state.query.lower()
        best: tuple[Intent, int] | None = None
        for intent, keywords in _INTENT_KEYWORDS.items():
            score = sum(1 for kw in keywords if re.search(re.escape(kw), text))
            if score and (best is None or score > best[1]):
                best = (intent, score)

        if best is None:
            result = IntentResult(
                intent=Intent.LEGAL_RESEARCH,
                confidence=0.55,
                rationale="No specialised intent keywords matched; defaulting to legal research.",
            )
        else:
            intent, score = best
            result = IntentResult(
                intent=intent,
                confidence=min(0.95, 0.6 + 0.1 * score),
                rationale=f"Matched {score} keyword(s) for {intent.value}.",
            )
        return {"intent": result}
