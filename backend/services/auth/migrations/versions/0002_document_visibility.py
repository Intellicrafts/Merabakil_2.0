"""Add visibility column to documents for corpus vs private docs."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0002_document_visibility"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'corpus';
        CREATE INDEX IF NOT EXISTS ix_documents_visibility ON documents (visibility);
        CREATE INDEX IF NOT EXISTS ix_documents_owner_id ON documents (owner_id);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS ix_documents_owner_id;
        DROP INDEX IF EXISTS ix_documents_visibility;
        ALTER TABLE documents DROP COLUMN IF EXISTS visibility;
        """
    )
