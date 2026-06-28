"""Jurisdiction detection agent for the Indian legal system."""

from __future__ import annotations

from legalos_orchestrator.agents.base import Agent
from legalos_orchestrator.schemas import JurisdictionResult, OrchestratorState

_STATES = (
    "maharashtra", "delhi", "karnataka", "tamil nadu", "gujarat", "uttar pradesh",
    "west bengal", "kerala", "rajasthan", "telangana", "punjab", "haryana", "bihar",
)


class JurisdictionAgent(Agent):
    name = "jurisdiction_agent"

    async def run(self, state: OrchestratorState) -> dict:
        text = f"{state.jurisdiction_hint or ''} {state.query}".lower()

        level = "central"
        region: str | None = None
        confidence = 0.6

        if "supreme court" in text:
            level, confidence = "supreme_court", 0.9
        elif "high court" in text:
            level, confidence = "high_court", 0.85
        elif "tribunal" in text:
            level, confidence = "tribunal", 0.8

        for st in _STATES:
            if st in text:
                region = st.title()
                if level == "central":
                    level = "state"
                confidence = max(confidence, 0.85)
                break

        result = JurisdictionResult(
            country="india", level=level, region=region, confidence=confidence
        )
        return {"jurisdiction": result}
