from __future__ import annotations

from app.api.schemas import LitigationStrategyRequest, LitigationStrategyResponse
from app.infrastructure.container import get_container
from app.infrastructure.llm_json import complete_json

_SYSTEM = (
    "You are an Indian litigation strategist. Respond ONLY with valid JSON:\n"
    '{"forum":"str","limitation_concerns":["str"],'
    '"procedural_steps":["str"],"required_documents":["str"]}\n'
    "Recommend forum, limitation issues, procedural steps, and documents under Indian law."
)

_FALLBACK = {
    "forum": "District Court / appropriate civil court having territorial and pecuniary jurisdiction",
    "limitation_concerns": [
        "Verify limitation period under the Limitation Act, 1963",
        "Check whether cause of action accrued and when",
    ],
    "procedural_steps": [
        "Issue legal notice where pre-litigation notice is advisable",
        "Prepare plaint with cause title, facts, and reliefs",
        "File vakalatnama and court fees as applicable",
        "Comply with Order VII CPC and local court rules",
    ],
    "required_documents": [
        "Agreement or contract copies",
        "Correspondence and legal notices",
        "Proof of payment or breach",
        "Identity and address proof of parties",
    ],
}


async def build_strategy(body: LitigationStrategyRequest) -> LitigationStrategyResponse:
    container = get_container()
    user_content = f"Query: {body.query}\n"
    if body.facts:
        user_content += f"Facts:\n{body.facts}\n"

    data = await complete_json(
        container.llm,
        system=_SYSTEM,
        user=user_content,
        fallback=_FALLBACK,
    )

    return LitigationStrategyResponse(
        forum=str(data.get("forum", _FALLBACK["forum"])),
        limitation_concerns=[
            str(x) for x in data.get("limitation_concerns", _FALLBACK["limitation_concerns"])
        ],
        procedural_steps=[
            str(x) for x in data.get("procedural_steps", _FALLBACK["procedural_steps"])
        ],
        required_documents=[
            str(x) for x in data.get("required_documents", _FALLBACK["required_documents"])
        ],
    )
