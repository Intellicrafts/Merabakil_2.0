"""Upsert a verified marketplace listing into native SQLite (auth ↔ marketplace)."""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
_DB = _ROOT / "data" / "marketplace.db"

_CREATE = """
CREATE TABLE IF NOT EXISTS lawyers (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL UNIQUE,
    slug VARCHAR(40) UNIQUE,
    bar_council_id VARCHAR(120),
    full_name VARCHAR(255) NOT NULL,
    city VARCHAR(80),
    practice_areas JSON NOT NULL DEFAULT '[]',
    jurisdictions JSON NOT NULL DEFAULT '[]',
    years_experience INTEGER NOT NULL DEFAULT 0,
    languages JSON NOT NULL DEFAULT '[]',
    rating NUMERIC(3, 2) NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    hourly_rate NUMERIC(10, 2),
    bio TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT 1,
    summary TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
)
"""


def _slug_for(user_id: uuid.UUID, full_name: str) -> str:
    token = user_id.hex[:8]
    stem = "".join(ch.lower() if ch.isalnum() else "-" for ch in full_name).strip("-")
    stem = "-".join(part for part in stem.split("-") if part)[:24] or "advocate"
    return f"{stem}-{token}"


def upsert_verified_lawyer(*, user_id: uuid.UUID, full_name: str) -> None:
    """Create or refresh a verified listing for a registered advocate. Best-effort."""
    _DB.parent.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc).isoformat()
    slug = _slug_for(user_id, full_name)
    lawyer_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"legalos.lawyer.user.{user_id}"))
    conn = sqlite3.connect(_DB)
    try:
        conn.execute(_CREATE)
        row = conn.execute(
            "SELECT id, slug FROM lawyers WHERE user_id = ?", (str(user_id),)
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE lawyers SET full_name = ?, is_verified = 1, updated_at = ? WHERE user_id = ?",
                (full_name, now, str(user_id)),
            )
        else:
            taken = conn.execute("SELECT 1 FROM lawyers WHERE slug = ?", (slug,)).fetchone()
            if taken:
                slug = f"adv-{user_id.hex[:10]}"
            conn.execute(
                """
                INSERT INTO lawyers (
                    id, user_id, slug, full_name, city, practice_areas, jurisdictions,
                    languages, years_experience, rating, rating_count, is_verified,
                    bio, summary, created_at, updated_at
                ) VALUES (?, ?, ?, ?, '', '[]', '[]', '[]', 0, 0, 0, 1, '', '', ?, ?)
                """,
                (lawyer_id, str(user_id), slug, full_name, now, now),
            )
        conn.commit()
    finally:
        conn.close()
