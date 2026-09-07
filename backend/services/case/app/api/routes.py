"""Case service HTTP routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status

from app.api.deps import get_case_service
from app.api.schemas import (
    CaseResponse,
    CaseShareResponse,
    CreateCaseRequest,
    ShareCaseRequest,
    UpdateCaseRequest,
)
from app.application.case_service import CaseService
from app.domain.entities import Case, CaseShare
from legalos_common.api.pagination import Page, PageParams, paginate
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions

router = APIRouter(prefix="/api/v1/cases", tags=["cases"])


def _case_to_response(c: Case) -> CaseResponse:
    return CaseResponse(
        id=str(c.id),
        owner_id=str(c.owner_id),
        title=c.title,
        description=c.description,
        case_number=c.case_number,
        court=c.court,
        jurisdiction=c.jurisdiction,
        practice_area=c.practice_area,
        status=c.status.value,
        source=c.source.value,
        session_id=c.session_id,
        ai_brief=c.ai_brief,
        created_at=c.created_at,
        updated_at=c.updated_at,
    )


def _share_to_response(s: CaseShare) -> CaseShareResponse:
    return CaseShareResponse(
        id=str(s.id),
        case_id=str(s.case_id),
        shared_by_user_id=str(s.shared_by_user_id),
        lawyer_user_id=str(s.lawyer_user_id),
        message=s.message,
        shared_at=s.shared_at,
        revoked_at=s.revoked_at,
    )


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    body: CreateCaseRequest,
    user: CurrentUser = Depends(require_permissions(Permission.CASE_WRITE.value)),
    svc: CaseService = Depends(get_case_service),
) -> CaseResponse:
    case = await svc.create(
        owner_id=uuid.UUID(user.user_id),
        title=body.title,
        description=body.description,
        case_number=body.case_number,
        court=body.court,
        jurisdiction=body.jurisdiction,
        practice_area=body.practice_area,
        status=body.status,
        source=body.source,
        session_id=body.session_id,
        ai_brief=body.ai_brief,
    )
    return _case_to_response(case)


@router.get("", response_model=Page[CaseResponse])
async def list_cases(
    status_filter: str | None = None,
    params: PageParams = Depends(PageParams.as_query),
    user: CurrentUser = Depends(require_permissions(Permission.CASE_READ.value)),
    svc: CaseService = Depends(get_case_service),
) -> Page[CaseResponse]:
    cases, total = await svc.list_own(
        uuid.UUID(user.user_id),
        status=status_filter or None,
        offset=params.offset,
        limit=params.size,
    )
    return paginate([_case_to_response(c) for c in cases], total, params)


@router.get("/shared-with-me", response_model=Page[CaseResponse])
async def list_shared_with_me(
    params: PageParams = Depends(PageParams.as_query),
    user: CurrentUser = Depends(require_permissions(Permission.CASE_READ.value)),
    svc: CaseService = Depends(get_case_service),
) -> Page[CaseResponse]:
    cases, total = await svc.list_shared(
        uuid.UUID(user.user_id),
        offset=params.offset,
        limit=params.size,
    )
    return paginate([_case_to_response(c) for c in cases], total, params)


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(require_permissions(Permission.CASE_READ.value)),
    svc: CaseService = Depends(get_case_service),
) -> CaseResponse:
    case = await svc.get(case_id, requesting_user_id=uuid.UUID(user.user_id))
    return _case_to_response(case)


@router.patch("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: uuid.UUID,
    body: UpdateCaseRequest,
    user: CurrentUser = Depends(require_permissions(Permission.CASE_WRITE.value)),
    svc: CaseService = Depends(get_case_service),
) -> CaseResponse:
    patch = body.model_dump(exclude_unset=True)
    case = await svc.update(
        case_id,
        requesting_user_id=uuid.UUID(user.user_id),
        **patch,
    )
    return _case_to_response(case)


@router.post("/{case_id}/share", response_model=CaseShareResponse, status_code=status.HTTP_201_CREATED)
async def share_case(
    case_id: uuid.UUID,
    body: ShareCaseRequest,
    user: CurrentUser = Depends(require_permissions(Permission.CASE_WRITE.value)),
    svc: CaseService = Depends(get_case_service),
) -> CaseShareResponse:
    share = await svc.share(
        case_id,
        requesting_user_id=uuid.UUID(user.user_id),
        lawyer_user_id=uuid.UUID(body.lawyer_user_id),
        message=body.message,
    )
    return _share_to_response(share)


@router.delete("/{case_id}/share/{lawyer_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share(
    case_id: uuid.UUID,
    lawyer_user_id: uuid.UUID,
    user: CurrentUser = Depends(require_permissions(Permission.CASE_WRITE.value)),
    svc: CaseService = Depends(get_case_service),
) -> None:
    await svc.revoke_share(
        case_id,
        requesting_user_id=uuid.UUID(user.user_id),
        lawyer_user_id=lawyer_user_id,
    )
