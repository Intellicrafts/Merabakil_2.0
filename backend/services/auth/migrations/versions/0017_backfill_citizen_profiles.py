"""Backfill citizen_profiles for existing citizen users who have no profile row.

Revision ID: 0017_backfill_citizen_profiles
Revises: 0016_user_avatar_url
Create Date: 2026-09-20
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0017_backfill_citizen_profiles"
down_revision: str | None = "0016_user_avatar_url"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO citizen_profiles (user_id, created_at, updated_at)
        SELECT u.id, NOW(), NOW()
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE r.name = 'citizen'
          AND u.id NOT IN (SELECT user_id FROM citizen_profiles)
    """)


def downgrade() -> None:
    pass
