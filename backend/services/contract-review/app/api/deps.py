from __future__ import annotations

from app.api.schemas import ContractClause, ContractReviewRequest, ContractReviewResponse
from app.infrastructure.container import get_container
from app.infrastructure.llm_json import complete_json

_SYSTEM = (
    "You are an Indian contract review specialist. Respond ONLY with valid JSON:\n"
    '{"clauses":[{"name":"str","summary":"str","risk":"low|medium|high"}],'
    '"missing_clauses":["str"],"risk_score":0.0-1.0,"flags":["str"]}\n'
    "Review the contract text or facts for Indian law compliance and commercial risk."
)

_FALLBACK = {
    "clauses": [
        {
            "name": "Indemnity",
            "summary": "Indemnity obligations should be reviewed for scope and cap.",
            "risk": "medium",
        }
    ],
    "missing_clauses": [
        "Limitation of liability",
        "Force majeure",
        "Dispute resolution / arbitration seat",
        "Governing law and jurisdiction",
    ],
    "risk_score": 0.55,
    "flags": [
        "Verify stamp duty and registration requirements under the Indian Stamp Act",
        "Check termination and notice periods",
    ],
}


async def analyze_contract(body: ContractReviewRequest) -> ContractReviewResponse:
    container = get_container()
    user_content = f"Query: {body.query}\n"
    if body.facts:
        user_content += f"Facts:\n{body.facts}\n"
    if body.document_id:
        user_content += f"Document ID: {body.document_id}\n"
    if body.text:
        user_content += f"Contract text:\n{body.text[:8000]}\n"

    data = await complete_json(
        container.llm,
        system=_SYSTEM,
        user=user_content,
        fallback=_FALLBACK,
    )

    clauses = [
        ContractClause(
            name=str(item.get("name", "Unnamed clause")),
            summary=str(item.get("summary", "")),
            risk=str(item.get("risk", "medium")),
        )
        for item in data.get("clauses", [])
    ]
    score = float(data.get("risk_score", _FALLBACK["risk_score"]))
    score = max(0.0, min(1.0, score))

    return ContractReviewResponse(
        clauses=clauses or [ContractClause(**_FALLBACK["clauses"][0])],
        missing_clauses=[str(x) for x in data.get("missing_clauses", _FALLBACK["missing_clauses"])],
        risk_score=score,
        flags=[str(x) for x in data.get("flags", _FALLBACK["flags"])],
    )
