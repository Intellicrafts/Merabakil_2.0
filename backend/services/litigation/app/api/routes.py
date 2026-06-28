"""Litigation strategy HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import build_strategy
from app.api.schemas import LitigationStrategyRequest, LitigationStrategyResponse
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions

router = APIRouter(prefix="/api/v1/litigation", tags=["litigation"])


@router.post(
    "/strategy",
    response_model=LitigationStrategyResponse,
    summary="Recommend litigation forum and procedural strategy (HttpSpecialistClient compatible)",
)
async def strategy(
    body: LitigationStrategyRequest,
    _: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> LitigationStrategyResponse:
    return await build_strategy(body)
