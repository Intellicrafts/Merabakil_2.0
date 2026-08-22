"""SQLite-safe lawyer profile model (replaces the Postgres-only ORM at runtime)."""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import Boolean, Integer, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from legalos_common.db import Base, TimestampMixin


class Lawyer(Base, TimestampMixin):
    __tablename__ = "lawyers"
    __table_args__ = {"extend_existing": True}

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), unique=True, nullable=False)
    slug: Mapped[str | None] = mapped_column(String(40), unique=True)
    bar_council_id: Mapped[str | None] = mapped_column(String(120))
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str | None] = mapped_column(String(80))
    practice_areas: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    jurisdictions: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    years_experience: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    languages: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    rating: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0, nullable=False)
    rating_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hourly_rate: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    bio: Mapped[str | None] = mapped_column(Text)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
