"""Add kind and action_url columns to notifications table.

Revision ID: 0015_notif_kind_action_url
Revises: 0014_user_consents
Create Date: 2026-09-13
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015_notif_kind_action_url"
down_revision: str | None = "0014_user_consents"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS kind VARCHAR(50) NOT NULL DEFAULT 'summon'"
    )
    op.execute(
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_url VARCHAR(500)"
    )


def downgrade() -> None:
    op.drop_column("notifications", "action_url")
    op.drop_column("notifications", "kind")
