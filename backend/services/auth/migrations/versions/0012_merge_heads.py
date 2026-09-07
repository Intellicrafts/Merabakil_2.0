"""Merge 0011_wallet and 0011_appointment_moderation heads.

Revision ID: 0012_merge_heads
Revises: 0011_wallet, 0011_appointment_moderation
Create Date: 2026-08-27
"""
from __future__ import annotations

from collections.abc import Sequence

revision: str = "0012_merge_heads"
down_revision: tuple[str, str] = ("0011_wallet", "0011_appointment_moderation")
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
