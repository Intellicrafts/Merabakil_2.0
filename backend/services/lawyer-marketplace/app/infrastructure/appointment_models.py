"""Appointment aggregate tables — consultations, messages, events, participants."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from legalos_common.db import Base, TimestampMixin


class Consultation(Base, TimestampMixin):
    __tablename__ = "consultations"
    __table_args__ = (
        Index("ix_consultations_lawyer_user_status", "lawyer_user_id", "status", "scheduled_at"),
        Index("ix_consultations_client_scheduled", "client_id", "scheduled_at"),
        {"extend_existing": True},
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    lawyer_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    case_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scheduled_end_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(50), default="requested", nullable=False)
    rating: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20), default="manual", nullable=False)
    matter_summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    time_slot: Mapped[str] = mapped_column(String(40), default="", nullable=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    live_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    livekit_room: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    citizen_user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    lawyer_user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    citizen_display_name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    lawyer_display_name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    last_summon_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    summon_for_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    metrics: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False)
    emergency_status: Mapped[str] = mapped_column(String(20), default="none", nullable=False)
    emergency_reason: Mapped[str] = mapped_column(Text, default="", nullable=False)
    emergency_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    emergency_ack_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    emergency_resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assigned_admin_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    ops_note: Mapped[str] = mapped_column(Text, default="", nullable=False)


class AppointmentMessage(Base):
    __tablename__ = "appointment_messages"
    __table_args__ = (Index("ix_appointment_messages_consult_created", "consultation_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False
    )
    sender_user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    sender_role: Mapped[str] = mapped_column(String(20), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    reactions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), default="text", nullable=False)
    attachment_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)


class AppointmentAttachment(Base):
    __tablename__ = "appointment_attachments"
    __table_args__ = (Index("ix_appointment_attachments_consult", "consultation_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False
    )
    sender_user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    receiver_user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream", nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), default="document", nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class AppointmentEvent(Base):
    __tablename__ = "appointment_events"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False
    )
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class AppointmentParticipant(Base):
    __tablename__ = "appointment_participants"

    consultation_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_read_message_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True))
    join_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    moderation_status: Mapped[str] = mapped_column(String(20), default="none", nullable=False)
    suspended_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    moderation_reason: Mapped[str] = mapped_column(Text, default="", nullable=False)
