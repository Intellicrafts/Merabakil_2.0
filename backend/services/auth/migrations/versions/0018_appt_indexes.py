"""Add indexes for appointment query performance optimization.

Revision ID: 0018_indexes
Revises: 0017_backfill_citizen_profiles
Create Date: 2026-09-20
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0018_indexes"
down_revision: str | None = "0017_backfill_citizen_profiles"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Index for appointment_participants queries filtering by consultation_id and last_seen_at
    op.create_index(
        "ix_appointment_participants_consultation_lastseen",
        "appointment_participants",
        ["consultation_id", "last_seen_at"],
        schema="public"
    )

    # Index for consultations queries filtering by lawyer_user_id
    op.create_index(
        "ix_consultations_lawyer_user_id",
        "consultations",
        ["lawyer_user_id"],
        schema="public"
    )


def downgrade() -> None:
    op.drop_index(
        "ix_consultations_lawyer_user_id",
        table_name="consultations",
        schema="public"
    )
    op.drop_index(
        "ix_appointment_participants_consultation_lastseen",
        table_name="appointment_participants",
        schema="public"
    )
