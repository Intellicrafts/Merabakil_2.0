from __future__ import annotations

from app.api.schemas import DraftingRequest, DraftingResponse
from app.infrastructure.container import get_container
from app.infrastructure.templates import get_template
from legalos_common.api.errors import ValidationFailedError
from legalos_common.clients.llm import ChatMessage

_SYSTEM = (
    "You are an Indian legal drafting assistant. Fill the supplied template using "
    "the provided variables. Preserve the template structure and headings. Use "
    "formal legal language appropriate for Indian courts and tribunals. Replace "
    "every {placeholder} with appropriate content; if a variable is missing, "
    "insert a clearly marked placeholder like [TO BE COMPLETED]. Output only the "
    "final drafted document text, not JSON."
)


async def generate_draft(body: DraftingRequest) -> DraftingResponse:
    template = get_template(body.template_type)
    if template is None:
        raise ValidationFailedError(
            f"Unknown template_type '{body.template_type}'. "
            "Supported: legal_notice, reply, contract_clause"
        )

    variables = {**body.variables, "jurisdiction": body.jurisdiction}
    try:
        skeleton = template.format_map(_SafeFormatMap(variables))
    except KeyError as exc:
        raise ValidationFailedError(f"Missing template variable: {exc}") from exc

    container = get_container()
    user_prompt = (
        f"Template type: {body.template_type}\n"
        f"Jurisdiction: {body.jurisdiction}\n"
        f"Variables: {variables}\n\n"
        f"Template skeleton:\n{skeleton}"
    )
    draft_text = await container.llm.complete(
        [
            ChatMessage(role="system", content=_SYSTEM),
            ChatMessage(role="user", content=user_prompt),
        ],
        temperature=0.2,
    )

    return DraftingResponse(
        template_type=body.template_type,
        jurisdiction=body.jurisdiction,
        draft_text=draft_text.strip(),
    )


class _SafeFormatMap(dict):
    def __missing__(self, key: str) -> str:
        return "{" + key + "}"
