"""Legal drafting HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import generate_draft
from app.api.schemas import DraftingRequest, DraftingResponse
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions

router = APIRouter(prefix="/api/v1/drafting", tags=["drafting"])


@router.post(
    "/generate",
    response_model=DraftingResponse,
    summary="Generate a legal draft from an in-memory template",
)
async def generate(
    body: DraftingRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> DraftingResponse:
    return await generate_draft(body)
