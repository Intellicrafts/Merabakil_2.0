"""Appointment message kinds and attachment table.

Revision ID: 0008_appointment_attachments
Revises: 0007_lawyer_verified_default
Create Date: 2026-08-23
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_appointment_attachments"
down_revision: str | None = "0007_lawyer_verified_default"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "appointment_messages",
        sa.Column("kind", sa.String(20), server_default="text", nullable=False),
    )
    op.add_column(
        "appointment_messages",
        sa.Column("attachment_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_table(
        "appointment_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "consultation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("consultations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sender_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receiver_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(120), server_default="application/octet-stream", nullable=False),
        sa.Column("size_bytes", sa.Integer(), server_default="0", nullable=False),
        sa.Column("kind", sa.String(20), server_default="document", nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_appointment_attachments_consult",
        "appointment_attachments",
        ["consultation_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_appointment_attachments_consult", table_name="appointment_attachments")
    op.drop_table("appointment_attachments")
    op.drop_column("appointment_messages", "attachment_id")
    op.drop_column("appointment_messages", "kind")
