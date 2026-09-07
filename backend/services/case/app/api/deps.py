from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.case_service import CaseService
from app.infrastructure.db import get_session
from app.infrastructure.repositories import SqlAlchemyCaseRepository, SqlAlchemyCaseShareRepository


def get_case_service(session: AsyncSession = Depends(get_session)) -> CaseService:
    return CaseService(
        cases=SqlAlchemyCaseRepository(session),
        shares=SqlAlchemyCaseShareRepository(session),
    )
