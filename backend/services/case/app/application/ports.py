"""Repository port protocols for the case service."""
from __future__ import annotations

import uuid
from typing import Any, Protocol

from app.domain.entities import Case, CaseShare, CaseStatus


class CaseRepository(Protocol):
    async def create(
        self,
        *,
        owner_id: uuid.UUID,
        title: str,
        description: str,
        case_number: str,
        court: str,
        jurisdiction: str,
        practice_area: str,
        status: CaseStatus,
        source: str,
        session_id: str | None,
        ai_brief: dict[str, Any],
    ) -> Case: ...

    async def get(self, case_id: uuid.UUID) -> Case | None: ...

    async def list_for_owner(
        self,
        owner_id: uuid.UUID,
        *,
        status: CaseStatus | None,
        offset: int,
        limit: int,
    ) -> tuple[list[Case], int]: ...

    async def update(self, case: Case) -> Case: ...

    async def list_shared_with_lawyer(
        self,
        lawyer_user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[Case], int]: ...

    async def has_lawyer_access(
        self,
        case_id: uuid.UUID,
        lawyer_user_id: uuid.UUID,
    ) -> bool: ...


class CaseShareRepository(Protocol):
    async def create(
        self,
        *,
        case_id: uuid.UUID,
        shared_by_user_id: uuid.UUID,
        lawyer_user_id: uuid.UUID,
        message: str,
    ) -> CaseShare: ...

    async def get(self, case_id: uuid.UUID, lawyer_user_id: uuid.UUID) -> CaseShare | None: ...

    async def revoke(self, share: CaseShare) -> CaseShare: ...
