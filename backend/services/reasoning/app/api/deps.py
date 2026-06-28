from __future__ import annotations

from app.api.schemas import ReasoningRequest, RiskAssessment, RiskIssue
from app.infrastructure.container import get_container
from app.infrastructure.llm_json import complete_json

_SYSTEM = (
    "You are an Indian legal risk analyst. Respond ONLY with valid JSON matching this schema:\n"
    '{"issues":[{"title":"str","severity":"low|medium|high","detail":"str"}],'
    '"strength_score":0.0-1.0,"missing_facts":["str"],'
    '"recommended_next_steps":["str"]}\n'
    "Assess the legal strength of the position given the query and facts."
)


async def analyze_request(body: ReasoningRequest) -> RiskAssessment:
    container = get_container()
    user_content = f"Query: {body.query}\n"
    if body.facts:
        user_content += f"Facts:\n{body.facts}\n"
    if body.document_id:
        user_content += f"Document ID: {body.document_id}\n"

    fallback = {
        "issues": [
            {
                "title": "Insufficient factual record",
                "severity": "medium",
                "detail": (
                    "The supplied facts do not establish all elements required for a "
                    "confident assessment under Indian law."
                ),
            }
        ],
        "strength_score": 0.45,
        "missing_facts": [
            "Chronology of events with dates",
            "Applicable jurisdiction and forum",
            "Written agreements or notices exchanged",
        ],
        "recommended_next_steps": [
            "Gather documentary evidence and witness statements",
            "Consult a licensed advocate for case-specific advice",
            "Verify limitation periods under the Limitation Act, 1963",
        ],
    }

    data = await complete_json(
        container.llm,
        system=_SYSTEM,
        user=user_content,
        fallback=fallback,
    )

    issues = [
        RiskIssue(
            title=str(item.get("title", "Unspecified issue")),
            severity=str(item.get("severity", "medium")),
            detail=str(item.get("detail", "")),
        )
        for item in data.get("issues", [])
    ]
    score = float(data.get("strength_score", fallback["strength_score"]))
    score = max(0.0, min(1.0, score))

    return RiskAssessment(
        issues=issues or [RiskIssue(**fallback["issues"][0])],
        strength_score=score,
        missing_facts=[str(x) for x in data.get("missing_facts", fallback["missing_facts"])],
        recommended_next_steps=[
            str(x) for x in data.get("recommended_next_steps", fallback["recommended_next_steps"])
        ],
    )
