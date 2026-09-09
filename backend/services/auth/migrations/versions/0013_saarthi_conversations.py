"""Add saarthi_conversations table for server-side chat history.

Revision ID: 0013_saarthi_conversations
Revises: 0012_case_brief
Create Date: 2026-09-10
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0013_saarthi_conversations"
down_revision: str | None = "0012_case_brief"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "saarthi_conversations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False, server_default="New Chat"),
        sa.Column(
            "messages",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("document_id", sa.String(36), nullable=True),
        sa.Column(
            "attached_documents",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'[]'::jsonb"),
        ),
        sa.Column("draft_case_id", sa.String(36), nullable=True),
        sa.Column("jurisdiction", sa.String(100), nullable=True),
        sa.Column("matter_type", sa.String(50), nullable=True),
        sa.Column("pinned", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_saarthi_conversations_user_updated",
        "saarthi_conversations",
        ["user_id", "updated_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_saarthi_conversations_user_updated", table_name="saarthi_conversations")
    op.drop_table("saarthi_conversations")
