"""Case use cases."""
from __future__ import annotations

import uuid
from typing import Any

from legalos_common.api.errors import AppError, NotFoundError

from app.application.ports import CaseRepository, CaseShareRepository
from app.domain.entities import Case, CaseShare, CaseStatus


class AccessDeniedError(AppError):
    status_code = 403
    code = "access_denied"


class ShareConflictError(AppError):
    status_code = 409
    code = "share_already_exists"


class CaseService:
    def __init__(self, cases: CaseRepository, shares: CaseShareRepository) -> None:
        self._cases = cases
        self._shares = shares

    async def create(
        self,
        *,
        owner_id: uuid.UUID,
        title: str,
        description: str = "",
        case_number: str = "",
        court: str = "",
        jurisdiction: str = "",
        practice_area: str = "",
        status: str = "open",
        source: str = "manual",
        session_id: str | None = None,
        ai_brief: dict[str, Any] | None = None,
    ) -> Case:
        return await self._cases.create(
            owner_id=owner_id,
            title=title,
            description=description,
            case_number=case_number,
            court=court,
            jurisdiction=jurisdiction,
            practice_area=practice_area,
            status=CaseStatus(status),
            source=source,
            session_id=session_id,
            ai_brief=ai_brief or {},
        )

    async def get(self, case_id: uuid.UUID, *, requesting_user_id: uuid.UUID) -> Case:
        case = await self._cases.get(case_id)
        if case is None:
            raise NotFoundError("Case not found")
        if case.owner_id == requesting_user_id:
            return case
        has_access = await self._cases.has_lawyer_access(case_id, requesting_user_id)
        if not has_access:
            raise AccessDeniedError("You do not have access to this case")
        return case

    async def list_own(
        self,
        owner_id: uuid.UUID,
        *,
        status: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Case], int]:
        st = CaseStatus(status) if status else None
        return await self._cases.list_for_owner(owner_id, status=st, offset=offset, limit=limit)

    async def list_shared(
        self,
        lawyer_user_id: uuid.UUID,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Case], int]:
        return await self._cases.list_shared_with_lawyer(
            lawyer_user_id, offset=offset, limit=limit
        )

    async def update(
        self,
        case_id: uuid.UUID,
        *,
        requesting_user_id: uuid.UUID,
        **fields: Any,
    ) -> Case:
        case = await self._cases.get(case_id)
        if case is None:
            raise NotFoundError("Case not found")
        if case.owner_id != requesting_user_id:
            raise AccessDeniedError("Only the case owner can update it")
        for key, value in fields.items():
            if hasattr(case, key) and value is not None:
                setattr(case, key, value)
        return await self._cases.update(case)

    async def share(
        self,
        case_id: uuid.UUID,
        *,
        requesting_user_id: uuid.UUID,
        lawyer_user_id: uuid.UUID,
        message: str = "",
    ) -> CaseShare:
        case = await self._cases.get(case_id)
        if case is None:
            raise NotFoundError("Case not found")
        if case.owner_id != requesting_user_id:
            raise AccessDeniedError("Only the case owner can share it")
        existing = await self._shares.get(case_id, lawyer_user_id)
        if existing and existing.revoked_at is None:
            raise ShareConflictError("Case is already shared with this lawyer")
        return await self._shares.create(
            case_id=case_id,
            shared_by_user_id=requesting_user_id,
            lawyer_user_id=lawyer_user_id,
            message=message,
        )

    async def revoke_share(
        self,
        case_id: uuid.UUID,
        *,
        requesting_user_id: uuid.UUID,
        lawyer_user_id: uuid.UUID,
    ) -> None:
        case = await self._cases.get(case_id)
        if case is None:
            raise NotFoundError("Case not found")
        if case.owner_id != requesting_user_id:
            raise AccessDeniedError("Only the case owner can revoke sharing")
        share = await self._shares.get(case_id, lawyer_user_id)
        if share is None or share.revoked_at is not None:
            raise NotFoundError("Share not found or already revoked")
        await self._shares.revoke(share)
