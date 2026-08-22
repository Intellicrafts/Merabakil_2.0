"""Repositories for lawyers and appointments."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import PRESENCE_TTL_SECONDS
from app.infrastructure.appointment_models import (
    AppointmentAttachment,
    AppointmentEvent,
    AppointmentMessage,
    AppointmentParticipant,
    Consultation,
)
from app.infrastructure.lawyer_model import Lawyer


class MarketplaceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_lawyers(
        self,
        *,
        query: str | None = None,
        practice_area: str | None = None,
        city: str | None = None,
        verified_only: bool = True,
    ) -> list[Lawyer]:
        stmt: Select[tuple[Lawyer]] = select(Lawyer).where(Lawyer.user_id.is_not(None))
        if verified_only:
            stmt = stmt.where(Lawyer.is_verified.is_(True))
        lawyers = list((await self._session.execute(stmt)).scalars().all())
        if practice_area:
            lawyers = [l for l in lawyers if practice_area in (l.practice_areas or [])]
        if city:
            city_l = city.lower()
            lawyers = [
                l
                for l in lawyers
                if (l.city or "").lower() == city_l
                or any(city_l in str(j).lower() for j in (l.jurisdictions or []))
            ]
        if query:
            q = query.strip().lower()
            lawyers = [
                l
                for l in lawyers
                if q in l.full_name.lower()
                or q in (l.city or "").lower()
                or q in (l.bio or "").lower()
                or any(q in a.lower() for a in (l.practice_areas or []))
            ]
        return lawyers

    async def get_lawyer(self, lawyer_id: uuid.UUID) -> Lawyer | None:
        return await self._session.get(Lawyer, lawyer_id)

    async def get_lawyer_by_slug(self, slug: str) -> Lawyer | None:
        result = await self._session.execute(select(Lawyer).where(Lawyer.slug == slug))
        return result.scalar_one_or_none()

    async def get_lawyer_by_user(self, user_id: uuid.UUID) -> Lawyer | None:
        result = await self._session.execute(select(Lawyer).where(Lawyer.user_id == user_id))
        return result.scalar_one_or_none()

    async def list_all_lawyers(self) -> list[Lawyer]:
        stmt = select(Lawyer).where(Lawyer.user_id.is_not(None)).order_by(Lawyer.full_name.asc())
        return list((await self._session.execute(stmt)).scalars().all())

    async def upsert_lawyer_for_user(
        self,
        user_id: uuid.UUID,
        *,
        full_name: str,
        bar_council_id: str | None = None,
        practice_areas: list[str] | None = None,
        jurisdictions: list[str] | None = None,
        languages: list[str] | None = None,
        city: str | None = None,
        years_experience: int | None = None,
        hourly_rate: float | None = None,
        bio: str | None = None,
        is_verified: bool | None = True,
    ) -> Lawyer:
        row = await self.get_lawyer_by_user(user_id)
        if row is None:
            slug = f"adv-{user_id.hex[:10]}"
            taken = await self.get_lawyer_by_slug(slug)
            if taken:
                slug = f"adv-{uuid.uuid4().hex[:10]}"
            row = Lawyer(
                user_id=user_id,
                slug=slug,
                full_name=full_name.strip() or "Advocate",
                is_verified=True if is_verified is None else is_verified,
                practice_areas=practice_areas or [],
                jurisdictions=jurisdictions or [],
                languages=languages or [],
                city=city or "",
                years_experience=years_experience or 0,
                hourly_rate=Decimal(str(hourly_rate)) if hourly_rate is not None else None,
                bar_council_id=bar_council_id,
                bio=bio or "",
                summary=bio or "",
            )
            self._session.add(row)
            await self._session.flush()
            return row
        if full_name.strip() and full_name.strip().lower() != "advocate":
            row.full_name = full_name.strip()
        if bar_council_id is not None:
            row.bar_council_id = bar_council_id
        if practice_areas is not None:
            row.practice_areas = practice_areas
        if jurisdictions is not None:
            row.jurisdictions = jurisdictions
        if languages is not None:
            row.languages = languages
        if city is not None:
            row.city = city
        if years_experience is not None:
            row.years_experience = years_experience
        if hourly_rate is not None:
            row.hourly_rate = Decimal(str(hourly_rate))
        if bio is not None:
            row.bio = bio
            row.summary = bio
        if is_verified is not None:
            row.is_verified = is_verified
        await self._session.flush()
        return row

    async def list_all_consultations(
        self,
        *,
        status: str | None = None,
        lawyer_id: uuid.UUID | None = None,
        citizen_id: uuid.UUID | None = None,
        search: str | None = None,
        emergency: str | None = None,
        limit: int = 200,
    ) -> list[Consultation]:
        stmt = select(Consultation).order_by(Consultation.scheduled_at.desc()).limit(limit)
        if status:
            stmt = stmt.where(Consultation.status == status)
        if lawyer_id:
            stmt = stmt.where(Consultation.lawyer_id == lawyer_id)
        if citizen_id:
            stmt = stmt.where(Consultation.client_id == citizen_id)
        if emergency:
            stmt = stmt.where(Consultation.emergency_status == emergency)
        rows = list((await self._session.execute(stmt)).scalars().all())
        if search:
            q = search.strip().lower()
            rows = [
                r
                for r in rows
                if q in (r.citizen_display_name or "").lower()
                or q in (r.lawyer_display_name or "").lower()
                or q in (r.matter_summary or "").lower()
                or q in str(r.id).lower()
            ]
        rank = {"open": 0, "ack": 1, "resolved": 2, "none": 3}
        rows.sort(
            key=lambda r: (
                rank.get(getattr(r, "emergency_status", None) or "none", 3),
                -(r.scheduled_at.timestamp() if r.scheduled_at else 0),
            )
        )
        return rows

    async def list_events(self, consultation_id: uuid.UUID, *, limit: int = 80) -> list[AppointmentEvent]:
        stmt = (
            select(AppointmentEvent)
            .where(AppointmentEvent.consultation_id == consultation_id)
            .order_by(AppointmentEvent.created_at.asc())
            .limit(limit)
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def create_consultation(self, **fields: object) -> Consultation:
        row = Consultation(**fields)
        self._session.add(row)
        await self._session.flush()
        return row

    async def get_consultation(self, consultation_id: uuid.UUID) -> Consultation | None:
        return await self._session.get(Consultation, consultation_id)

    async def list_consultations_for_user(self, user_id: uuid.UUID, *, as_lawyer: bool) -> list[Consultation]:
        if as_lawyer:
            stmt = select(Consultation).where(Consultation.lawyer_user_id == user_id)
        else:
            stmt = select(Consultation).where(Consultation.client_id == user_id)
        stmt = stmt.order_by(Consultation.scheduled_at.desc())
        return list((await self._session.execute(stmt)).scalars().all())

    async def slot_taken(self, lawyer_id: uuid.UUID, scheduled_at: datetime) -> bool:
        stmt = select(Consultation.id).where(
            Consultation.lawyer_id == lawyer_id,
            Consultation.scheduled_at == scheduled_at,
            Consultation.status.notin_(("cancelled", "expired", "no_show")),
        )
        return (await self._session.execute(stmt)).scalar_one_or_none() is not None

    async def add_event(
        self,
        consultation_id: uuid.UUID,
        type: str,
        actor_user_id: uuid.UUID | None,
        payload: dict | None = None,
    ) -> None:
        self._session.add(
            AppointmentEvent(
                consultation_id=consultation_id,
                type=type,
                actor_user_id=actor_user_id,
                payload=payload or {},
            )
        )

    async def upsert_participant(
        self,
        consultation_id: uuid.UUID,
        user_id: uuid.UUID,
        role: str,
        *,
        bump_join: bool = False,
    ) -> AppointmentParticipant:
        row = await self._session.get(AppointmentParticipant, (consultation_id, user_id))
        now = datetime.now().astimezone()
        if row is None:
            row = AppointmentParticipant(
                consultation_id=consultation_id,
                user_id=user_id,
                role=role,
                last_seen_at=now,
                join_count=1 if bump_join else 0,
            )
            self._session.add(row)
        else:
            row.last_seen_at = now
            if bump_join:
                row.join_count = (row.join_count or 0) + 1
        await self._session.flush()
        return row

    async def leave_participant(self, consultation_id: uuid.UUID, user_id: uuid.UUID) -> None:
        row = await self._session.get(AppointmentParticipant, (consultation_id, user_id))
        if row is None:
            return
        row.last_seen_at = None
        await self._session.flush()

    async def participant(self, consultation_id: uuid.UUID, user_id: uuid.UUID) -> AppointmentParticipant | None:
        return await self._session.get(AppointmentParticipant, (consultation_id, user_id))

    async def party_presence(self, row: Consultation) -> tuple[bool, bool]:
        cutoff = datetime.now().astimezone() - timedelta(seconds=PRESENCE_TTL_SECONDS)
        stmt = select(AppointmentParticipant).where(
            AppointmentParticipant.consultation_id == row.id,
            AppointmentParticipant.last_seen_at.is_not(None),
            AppointmentParticipant.last_seen_at >= cutoff,
        )
        present = {p.user_id for p in (await self._session.execute(stmt)).scalars().all()}
        return row.citizen_user_id in present, row.lawyer_user_id in present

    async def last_event(self, consultation_id: uuid.UUID, type: str) -> AppointmentEvent | None:
        stmt = (
            select(AppointmentEvent)
            .where(AppointmentEvent.consultation_id == consultation_id, AppointmentEvent.type == type)
            .order_by(AppointmentEvent.created_at.desc())
            .limit(1)
        )
        return (await self._session.execute(stmt)).scalar_one_or_none()

    async def opponent_present(self, consultation_id: uuid.UUID, user_id: uuid.UUID) -> bool:
        row = await self.get_consultation(consultation_id)
        if not row:
            return False
        if user_id not in {row.citizen_user_id, row.lawyer_user_id}:
            return False
        opponent_id = row.lawyer_user_id if user_id == row.citizen_user_id else row.citizen_user_id
        cutoff = datetime.now().astimezone() - timedelta(seconds=PRESENCE_TTL_SECONDS)
        stmt = (
            select(AppointmentParticipant)
            .where(
                AppointmentParticipant.consultation_id == consultation_id,
                AppointmentParticipant.user_id == opponent_id,
                AppointmentParticipant.last_seen_at.is_not(None),
                AppointmentParticipant.last_seen_at >= cutoff,
            )
            .limit(1)
        )
        return (await self._session.execute(stmt)).scalar_one_or_none() is not None

    async def list_messages(
        self,
        consultation_id: uuid.UUID,
        *,
        limit: int = 50,
        after: uuid.UUID | None = None,
    ) -> list[AppointmentMessage]:
        stmt = select(AppointmentMessage).where(AppointmentMessage.consultation_id == consultation_id)
        if after is not None:
            pivot = await self.get_message(after)
            if pivot and pivot.consultation_id == consultation_id:
                stmt = stmt.where(
                    (AppointmentMessage.created_at > pivot.created_at)
                    | (
                        (AppointmentMessage.created_at == pivot.created_at)
                        & (AppointmentMessage.id > pivot.id)
                    )
                )
        stmt = stmt.order_by(AppointmentMessage.created_at.asc()).limit(limit)
        return list((await self._session.execute(stmt)).scalars().all())

    async def add_message(self, **fields: object) -> AppointmentMessage:
        row = AppointmentMessage(**fields)
        self._session.add(row)
        await self._session.flush()
        return row

    async def get_message(self, message_id: uuid.UUID) -> AppointmentMessage | None:
        return await self._session.get(AppointmentMessage, message_id)

    async def add_attachment(self, **fields: object) -> AppointmentAttachment:
        row = AppointmentAttachment(**fields)
        self._session.add(row)
        await self._session.flush()
        return row

    async def get_attachment(self, attachment_id: uuid.UUID) -> AppointmentAttachment | None:
        return await self._session.get(AppointmentAttachment, attachment_id)

    async def list_attachments(self, consultation_id: uuid.UUID) -> list[AppointmentAttachment]:
        stmt = (
            select(AppointmentAttachment)
            .where(AppointmentAttachment.consultation_id == consultation_id)
            .order_by(AppointmentAttachment.created_at.asc())
        )
        return list((await self._session.execute(stmt)).scalars().all())

    async def mark_read(
        self,
        consultation_id: uuid.UUID,
        user_id: uuid.UUID,
        message_id: uuid.UUID | None = None,
    ) -> AppointmentParticipant | None:
        row = await self.participant(consultation_id, user_id)
        if row is None:
            return None
        if message_id is not None:
            row.last_read_message_id = message_id
        await self._session.flush()
        return row

    async def message_count(self, consultation_id: uuid.UUID) -> int:
        from sqlalchemy import func

        return int(
            await self._session.scalar(
                select(func.count()).where(AppointmentMessage.consultation_id == consultation_id)
            )
            or 0
        )
