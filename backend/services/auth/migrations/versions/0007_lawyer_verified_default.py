"""Default lawyers.is_verified to true for new advocate registrations.

Revision ID: 0007_lawyer_verified_default
Revises: 0006_appointment_ops
Create Date: 2026-08-23
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_lawyer_verified_default"
down_revision: str | None = "0006_appointment_ops"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column(
        "lawyers",
        "is_verified",
        existing_type=sa.Boolean(),
        server_default=sa.text("true"),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "lawyers",
        "is_verified",
        existing_type=sa.Boolean(),
        server_default=sa.text("false"),
        existing_nullable=False,
    )
