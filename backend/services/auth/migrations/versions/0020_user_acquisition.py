"""Add acquisition attribution columns to users table.

Captures Google Ads gclid + UTM source/campaign at signup so accounts can be
tied back to the ad click/campaign that produced them.

Revision ID: 0020_user_acquisition
Revises: 0019_email_otp_codes
Create Date: 2026-09-23
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0020_user_acquisition"
down_revision: str | None = "0019_email_otp_codes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_gclid VARCHAR(512)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_utm_source VARCHAR(255)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS acquisition_utm_campaign VARCHAR(255)")


def downgrade() -> None:
    op.drop_column("users", "acquisition_utm_campaign")
    op.drop_column("users", "acquisition_utm_source")
    op.drop_column("users", "acquisition_gclid")
