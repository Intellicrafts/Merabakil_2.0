"""Contract review HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import analyze_contract
from app.api.schemas import ContractReviewRequest, ContractReviewResponse
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions

router = APIRouter(prefix="/api/v1/contract-review", tags=["contract-review"])


@router.post(
    "/analyze",
    response_model=ContractReviewResponse,
    summary="Analyze contract clauses and risk (HttpSpecialistClient compatible)",
)
async def analyze(
    body: ContractReviewRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> ContractReviewResponse:
    return await analyze_contract(body)
