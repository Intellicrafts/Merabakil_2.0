"""Extend consultations and add appointment message/event/participant tables.

Revision ID: 0006_appointment_ops
Revises: 0005_role_profiles
Create Date: 2026-08-23
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_appointment_ops"
down_revision: str | None = "0005_role_profiles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("lawyers", sa.Column("slug", sa.String(40), nullable=True))
    op.add_column("lawyers", sa.Column("city", sa.String(80), nullable=True))
    op.create_index("ix_lawyers_slug", "lawyers", ["slug"], unique=True)

    op.add_column("consultations", sa.Column("source", sa.String(20), server_default="manual", nullable=False))
    op.add_column("consultations", sa.Column("matter_summary", sa.Text(), server_default="", nullable=False))
    op.add_column("consultations", sa.Column("time_slot", sa.String(40), server_default="", nullable=False))
    op.add_column("consultations", sa.Column("scheduled_end_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("consultations", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("consultations", sa.Column("live_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("consultations", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("consultations", sa.Column("expired_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("consultations", sa.Column("livekit_room", sa.String(80), server_default="", nullable=False))
    op.add_column("consultations", sa.Column("citizen_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("consultations", sa.Column("lawyer_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("consultations", sa.Column("citizen_display_name", sa.String(255), server_default="", nullable=False))
    op.add_column("consultations", sa.Column("lawyer_display_name", sa.String(255), server_default="", nullable=False))
    op.add_column("consultations", sa.Column("last_summon_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("consultations", sa.Column("summon_for_user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(
        "consultations",
        sa.Column("metrics", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
    )
    op.create_index("ix_consultations_lawyer_user_status", "consultations", ["lawyer_user_id", "status", "scheduled_at"])
    op.create_index("ix_consultations_client_scheduled", "consultations", ["client_id", "scheduled_at"])

    op.create_table(
        "appointment_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("consultation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sender_role", sa.String(20), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reactions", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
    )
    op.create_index("ix_appointment_messages_consult_created", "appointment_messages", ["consultation_id", "created_at"])

    op.create_table(
        "appointment_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("consultation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(40), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(), server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "appointment_participants",
        sa.Column("consultation_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_read_message_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("join_count", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_table("appointment_participants")
    op.drop_table("appointment_events")
    op.drop_index("ix_appointment_messages_consult_created", table_name="appointment_messages")
    op.drop_table("appointment_messages")
    op.drop_index("ix_consultations_client_scheduled", table_name="consultations")
    op.drop_index("ix_consultations_lawyer_user_status", table_name="consultations")
    for col in (
        "metrics",
        "summon_for_user_id",
        "last_summon_at",
        "lawyer_display_name",
        "citizen_display_name",
        "lawyer_user_id",
        "citizen_user_id",
        "livekit_room",
        "expired_at",
        "completed_at",
        "live_started_at",
        "confirmed_at",
        "scheduled_end_at",
        "time_slot",
        "matter_summary",
        "source",
    ):
        op.drop_column("consultations", col)
    op.drop_index("ix_lawyers_slug", table_name="lawyers")
    op.drop_column("lawyers", "city")
    op.drop_column("lawyers", "slug")
