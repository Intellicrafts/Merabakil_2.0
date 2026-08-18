"""Add content_hash to documents for incremental ingest upsert."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0003_document_content_hash"
down_revision: str | None = "0002_document_visibility"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);
        CREATE INDEX IF NOT EXISTS ix_documents_source_uri ON documents (source_uri);
        CREATE INDEX IF NOT EXISTS ix_documents_content_hash ON documents (content_hash);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS ix_documents_content_hash;
        DROP INDEX IF EXISTS ix_documents_source_uri;
        ALTER TABLE documents DROP COLUMN IF EXISTS content_hash;
        """
    )
