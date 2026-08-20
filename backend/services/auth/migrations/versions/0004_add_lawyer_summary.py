"""Add summary column to lawyers table.

Revision ID: 0004_lawyer_summary
Revises: 0003_document_content_hash
Create Date: 2026-08-20
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_lawyer_summary"
down_revision: str | None = "0003_document_content_hash"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("lawyers", sa.Column("summary", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("lawyers", "summary")
