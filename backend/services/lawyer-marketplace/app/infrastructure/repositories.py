"""Repository for lawyer read/write operations."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.lawyer_model import Lawyer


class LawyerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, lawyer_id: uuid.UUID) -> Lawyer | None:
        result = await self._session.execute(
            select(Lawyer).where(Lawyer.id == lawyer_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self) -> list[Lawyer]:
        result = await self._session.execute(select(Lawyer))
        return list(result.scalars().all())

    async def get_by_ids(self, ids: list[uuid.UUID]) -> list[Lawyer]:
        result = await self._session.execute(
            select(Lawyer).where(Lawyer.id.in_(ids))
        )
        return list(result.scalars().all())

    async def get_all_without_summary(self) -> list[Lawyer]:
        result = await self._session.execute(
            select(Lawyer).where(Lawyer.summary.is_(None))
        )
        return list(result.scalars().all())

    async def match(
        self,
        practice_areas: list[str],
        jurisdictions: list[str],
        limit: int = 3,
    ) -> list[Lawyer]:
        """
        Return up to `limit` lawyers whose practice_areas or jurisdictions overlap
        with the supplied lists. Falls back to all lawyers (best-rated first) when
        no JSONB overlap is found.
        """
        if practice_areas or jurisdictions:
            # PostgreSQL ?| operator: array overlap on JSONB
            filters: list[str] = []
            params: dict[str, Any] = {"limit": limit}

            if practice_areas:
                filters.append("practice_areas ?| :practice_areas")
                params["practice_areas"] = practice_areas
            if jurisdictions:
                filters.append("jurisdictions ?| :jurisdictions")
                params["jurisdictions"] = jurisdictions

            where_clause = " OR ".join(filters)
            stmt = text(
                f"SELECT id FROM lawyers WHERE {where_clause} "
                "ORDER BY is_verified DESC, rating DESC "
                "LIMIT :limit"
            ).bindparams(**params)

            rows = await self._session.execute(stmt)
            ids = [row[0] for row in rows.fetchall()]

            if ids:
                result = await self._session.execute(
                    select(Lawyer).where(Lawyer.id.in_(ids))
                )
                return list(result.scalars().all())

        # Fallback: return top-rated lawyers regardless of filter
        result = await self._session.execute(
            select(Lawyer)
            .order_by(Lawyer.is_verified.desc(), Lawyer.rating.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def create(self, **kwargs: object) -> Lawyer:
        lawyer = Lawyer(**kwargs)
        self._session.add(lawyer)
        await self._session.flush()  # populate lawyer.id without committing
        return lawyer

    async def create_or_update_for_user(self, *, user_id: uuid.UUID, **fields: object) -> Lawyer:
        """Populate the advocate profile created during account registration.

        An advocate receives an empty ``lawyers`` row at signup.  Completing
        the marketplace form enriches that same row rather than creating a
        second profile for the user.
        """
        lawyer = (
            await self._session.execute(select(Lawyer).where(Lawyer.user_id == user_id))
        ).scalar_one_or_none()
        if lawyer is None:
            return await self.create(user_id=user_id, **fields)

        for field, value in fields.items():
            setattr(lawyer, field, value)
        await self._session.flush()
        return lawyer

    async def update_summary(self, lawyer_id: uuid.UUID, summary: str) -> None:
        await self._session.execute(
            update(Lawyer).where(Lawyer.id == lawyer_id).values(summary=summary)
        )
        await self._session.commit()
