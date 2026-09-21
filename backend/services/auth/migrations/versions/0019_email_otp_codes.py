"""Add email_otp_codes table for registration and login OTP flows.

Revision ID: 0019_email_otp_codes
Revises: 0018_indexes
Create Date: 2026-09-22
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0019_email_otp_codes"
down_revision: str | None = "0018_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE email_otp_codes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL,
            purpose VARCHAR(20) NOT NULL,
            code_hash VARCHAR(128) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used BOOLEAN NOT NULL DEFAULT FALSE,
            attempt_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("""
        CREATE INDEX ix_email_otp_email_purpose
        ON email_otp_codes (email, purpose)
    """)
    op.execute("""
        CREATE INDEX ix_email_otp_created_at
        ON email_otp_codes (created_at)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS email_otp_codes")
