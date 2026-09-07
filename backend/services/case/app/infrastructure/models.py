from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from legalos_common.db import Base, TimestampMixin, UUIDMixin


class CaseModel(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "cases"
    __table_args__ = (
        Index("ix_cases_session_id", "session_id"),
        Index("ix_cases_owner_status", "owner_id", "status"),
        {"extend_existing": True},
    )

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    case_number: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    court: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    jurisdiction: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    practice_area: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ai_brief: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )


class CaseShareModel(Base):
    __tablename__ = "case_shares"
    __table_args__ = (
        Index("ix_case_shares_case", "case_id"),
        Index("ix_case_shares_lawyer", "lawyer_user_id"),
        UniqueConstraint("case_id", "lawyer_user_id", name="uq_case_shares_case_lawyer"),
        {"extend_existing": True},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cases.id", ondelete="CASCADE"),
        nullable=False,
    )
    shared_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    lawyer_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    shared_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
