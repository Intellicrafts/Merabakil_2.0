"""SQLAlchemy repository implementations for the case service."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities import Case, CaseShare, CaseSource, CaseStatus
from app.infrastructure.models import CaseModel, CaseShareModel


def _to_case(row: CaseModel) -> Case:
    return Case(
        id=row.id,
        owner_id=row.owner_id,
        title=row.title,
        description=row.description,
        case_number=row.case_number,
        court=row.court,
        jurisdiction=row.jurisdiction,
        practice_area=row.practice_area,
        status=CaseStatus(row.status),
        source=CaseSource(row.source),
        session_id=row.session_id,
        ai_brief=row.ai_brief or {},
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _to_share(row: CaseShareModel) -> CaseShare:
    return CaseShare(
        id=row.id,
        case_id=row.case_id,
        shared_by_user_id=row.shared_by_user_id,
        lawyer_user_id=row.lawyer_user_id,
        message=row.message,
        shared_at=row.shared_at,
        revoked_at=row.revoked_at,
    )


class SqlAlchemyCaseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

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
    ) -> Case:
        row = CaseModel(
            owner_id=owner_id,
            title=title,
            description=description,
            case_number=case_number,
            court=court,
            jurisdiction=jurisdiction,
            practice_area=practice_area,
            status=status.value,
            source=source,
            session_id=session_id,
            ai_brief=ai_brief,
            metadata_={},
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _to_case(row)

    async def get(self, case_id: uuid.UUID) -> Case | None:
        result = await self._session.execute(
            select(CaseModel).where(CaseModel.id == case_id)
        )
        row = result.scalar_one_or_none()
        return _to_case(row) if row else None

    async def list_for_owner(
        self,
        owner_id: uuid.UUID,
        *,
        status: CaseStatus | None,
        offset: int,
        limit: int,
    ) -> tuple[list[Case], int]:
        q = select(CaseModel).where(CaseModel.owner_id == owner_id)
        if status:
            q = q.where(CaseModel.status == status.value)
        total_result = await self._session.execute(
            select(func.count()).select_from(q.subquery())
        )
        total = total_result.scalar_one()
        rows_result = await self._session.execute(
            q.order_by(CaseModel.updated_at.desc()).offset(offset).limit(limit)
        )
        rows = rows_result.scalars().all()
        return [_to_case(r) for r in rows], total

    async def update(self, case: Case) -> Case:
        result = await self._session.execute(
            select(CaseModel).where(CaseModel.id == case.id)
        )
        row = result.scalar_one()
        row.title = case.title
        row.description = case.description
        row.case_number = case.case_number
        row.court = case.court
        row.jurisdiction = case.jurisdiction
        row.practice_area = case.practice_area
        row.status = case.status.value
        row.ai_brief = case.ai_brief
        await self._session.flush()
        await self._session.refresh(row)
        return _to_case(row)

    async def list_shared_with_lawyer(
        self,
        lawyer_user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[Case], int]:
        # Cases shared via case_shares (active) OR linked via consultations
        from sqlalchemy import text

        q = (
            select(CaseModel)
            .join(
                CaseShareModel,
                (CaseShareModel.case_id == CaseModel.id)
                & (CaseShareModel.lawyer_user_id == lawyer_user_id)
                & (CaseShareModel.revoked_at.is_(None)),
                isouter=True,
            )
            .where(CaseShareModel.id.isnot(None))
        )
        total_result = await self._session.execute(
            select(func.count()).select_from(q.subquery())
        )
        total = total_result.scalar_one()
        rows_result = await self._session.execute(
            q.order_by(CaseModel.updated_at.desc()).offset(offset).limit(limit)
        )
        rows = rows_result.scalars().all()
        return [_to_case(r) for r in rows], total

    async def has_lawyer_access(
        self,
        case_id: uuid.UUID,
        lawyer_user_id: uuid.UUID,
    ) -> bool:
        share_q = select(CaseShareModel.id).where(
            (CaseShareModel.case_id == case_id)
            & (CaseShareModel.lawyer_user_id == lawyer_user_id)
            & (CaseShareModel.revoked_at.is_(None))
        )
        result = await self._session.execute(share_q)
        if result.scalar_one_or_none():
            return True
        # Check consultation link — cross-service, so we use a raw exists query
        # The consultations table lives in the same DB
        from sqlalchemy import text as sql_text
        exists_sql = sql_text(
            "SELECT 1 FROM consultations "
            "WHERE case_id = :case_id AND lawyer_user_id = :lawyer_user_id LIMIT 1"
        )
        res = await self._session.execute(
            exists_sql,
            {"case_id": str(case_id), "lawyer_user_id": str(lawyer_user_id)},
        )
        return res.scalar_one_or_none() is not None


class SqlAlchemyCaseShareRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        case_id: uuid.UUID,
        shared_by_user_id: uuid.UUID,
        lawyer_user_id: uuid.UUID,
        message: str,
    ) -> CaseShare:
        row = CaseShareModel(
            case_id=case_id,
            shared_by_user_id=shared_by_user_id,
            lawyer_user_id=lawyer_user_id,
            message=message,
            shared_at=datetime.now(tz=timezone.utc),
        )
        self._session.add(row)
        await self._session.flush()
        await self._session.refresh(row)
        return _to_share(row)

    async def get(self, case_id: uuid.UUID, lawyer_user_id: uuid.UUID) -> CaseShare | None:
        result = await self._session.execute(
            select(CaseShareModel).where(
                (CaseShareModel.case_id == case_id)
                & (CaseShareModel.lawyer_user_id == lawyer_user_id)
            )
        )
        row = result.scalar_one_or_none()
        return _to_share(row) if row else None

    async def revoke(self, share: CaseShare) -> CaseShare:
        result = await self._session.execute(
            select(CaseShareModel).where(CaseShareModel.id == share.id)
        )
        row = result.scalar_one()
        row.revoked_at = datetime.now(tz=timezone.utc)
        await self._session.flush()
        return _to_share(row)
