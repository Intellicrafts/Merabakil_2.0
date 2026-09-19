"""Add avatar_url column to users table.

Revision ID: 0016_user_avatar_url
Revises: 0015_notif_kind_action_url
Create Date: 2026-09-18
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016_user_avatar_url"
down_revision: str | None = "0015_notif_kind_action_url"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512)"
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_url")
