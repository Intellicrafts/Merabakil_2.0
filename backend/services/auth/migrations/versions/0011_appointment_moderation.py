"""Appointment participant kick/suspend moderation columns.

Revision ID: 0011_appointment_moderation
Revises: 0010_add_oauth_identities
Create Date: 2026-08-26
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_appointment_moderation"
down_revision: str | None = "0010_add_oauth_identities"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "appointment_participants",
        sa.Column("moderation_status", sa.String(20), server_default="none", nullable=False),
    )
    op.add_column("appointment_participants", sa.Column("suspended_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "appointment_participants",
        sa.Column("moderation_reason", sa.Text(), server_default="", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("appointment_participants", "moderation_reason")
    op.drop_column("appointment_participants", "suspended_until")
    op.drop_column("appointment_participants", "moderation_status")
