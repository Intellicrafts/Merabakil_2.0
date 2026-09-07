"""Extend cases table with AI brief fields; add case_shares table.

Revision ID: 0012_case_brief
Revises: 0011_wallet
Create Date: 2026-08-27
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012_case_brief"
down_revision: str | None = "0011_wallet"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Extend cases table
    op.add_column("cases", sa.Column("source", sa.String(20), nullable=False, server_default="manual"))
    op.add_column("cases", sa.Column("session_id", sa.String(255), nullable=True))
    op.add_column(
        "cases",
        sa.Column(
            "ai_brief",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
    )
    op.create_index("ix_cases_session_id", "cases", ["session_id"])
    op.create_index("ix_cases_owner_status", "cases", ["owner_id", "status"])

    # New case_shares table
    op.create_table(
        "case_shares",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "case_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("cases.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "shared_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "lawyer_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("message", sa.Text, nullable=False, server_default=""),
        sa.Column(
            "shared_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("case_id", "lawyer_user_id", name="uq_case_shares_case_lawyer"),
    )
    op.create_index("ix_case_shares_case", "case_shares", ["case_id"])
    op.create_index("ix_case_shares_lawyer", "case_shares", ["lawyer_user_id"])


def downgrade() -> None:
    op.drop_index("ix_case_shares_lawyer", table_name="case_shares")
    op.drop_index("ix_case_shares_case", table_name="case_shares")
    op.drop_table("case_shares")
    op.drop_index("ix_cases_owner_status", table_name="cases")
    op.drop_index("ix_cases_session_id", table_name="cases")
    op.drop_column("cases", "ai_brief")
    op.drop_column("cases", "session_id")
    op.drop_column("cases", "source")
