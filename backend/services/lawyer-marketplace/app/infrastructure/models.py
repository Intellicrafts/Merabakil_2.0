"""ORM model for the lawyers table."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from legalos_common.db import Base, TimestampMixin, UUIDMixin


class Lawyer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "lawyers"
    __table_args__ = {"extend_existing": True}

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    bar_council_id: Mapped[str | None] = mapped_column(String(120))
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    practice_areas: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    jurisdictions: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    years_experience: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    languages: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0, nullable=False)
    rating_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hourly_rate: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    bio: Mapped[str | None] = mapped_column(Text)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
