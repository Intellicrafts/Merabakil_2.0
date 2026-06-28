"""Legal reasoning HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import analyze_request
from app.api.schemas import ReasoningRequest, RiskAssessment
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions

router = APIRouter(prefix="/api/v1/reasoning", tags=["reasoning"])


@router.post(
    "/analyze",
    response_model=RiskAssessment,
    summary="Analyze legal risk from facts and query",
)
async def analyze(
    body: ReasoningRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> RiskAssessment:
    return await analyze_request(body)
