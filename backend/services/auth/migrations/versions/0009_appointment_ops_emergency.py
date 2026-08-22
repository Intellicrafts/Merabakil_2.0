"""Consultation priority and emergency ops columns.

Revision ID: 0009_appointment_ops_emergency
Revises: 0008_appointment_attachments
Create Date: 2026-08-23
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009_appointment_ops_emergency"
down_revision: str | None = "0008_appointment_attachments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("consultations", sa.Column("priority", sa.String(20), server_default="normal", nullable=False))
    op.add_column(
        "consultations",
        sa.Column("emergency_status", sa.String(20), server_default="none", nullable=False),
    )
    op.add_column("consultations", sa.Column("emergency_reason", sa.Text(), server_default="", nullable=False))
    op.add_column("consultations", sa.Column("emergency_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("consultations", sa.Column("emergency_ack_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("consultations", sa.Column("emergency_resolved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "consultations",
        sa.Column("assigned_admin_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column("consultations", sa.Column("ops_note", sa.Text(), server_default="", nullable=False))


def downgrade() -> None:
    op.drop_column("consultations", "ops_note")
    op.drop_column("consultations", "assigned_admin_user_id")
    op.drop_column("consultations", "emergency_resolved_at")
    op.drop_column("consultations", "emergency_ack_at")
    op.drop_column("consultations", "emergency_at")
    op.drop_column("consultations", "emergency_reason")
    op.drop_column("consultations", "emergency_status")
    op.drop_column("consultations", "priority")
