#!/usr/bin/env python3
"""Lawyer Marketplace service — native dev mode (in-memory lawyers, no Postgres)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
import sys

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "backend" / "scripts"))
from dev_bootstrap import bootstrap_dev_env  # noqa: E402

bootstrap_dev_env(_ROOT)

sys.path[:0] = [
    str(_ROOT / "backend" / "libs" / "legalos_common"),
    str(_ROOT / "backend" / "services" / "lawyer-marketplace"),
]

from app.infrastructure.db import get_async_session  # noqa: E402
from app.infrastructure.models import Lawyer  # noqa: E402
from app.main import app  # noqa: E402

# ---------------------------------------------------------------------------
# Seed data: sample lawyers for native dev / demo
# ---------------------------------------------------------------------------

_NOW = datetime(2026, 1, 1, tzinfo=UTC)


def _lawyer(**kw) -> Lawyer:
    l = Lawyer()
    l.id = kw.get("id", uuid.uuid4())
    l.user_id = kw.get("user_id", uuid.uuid4())
    l.created_at = _NOW
    l.updated_at = _NOW
    l.bar_council_id = kw.get("bar_council_id")
    l.full_name = kw["full_name"]
    l.practice_areas = kw.get("practice_areas", [])
    l.jurisdictions = kw.get("jurisdictions", [])
    l.years_experience = kw.get("years_experience", 0)
    l.languages = kw.get("languages", ["English"])
    l.rating = Decimal(str(kw.get("rating", "4.0")))
    l.rating_count = kw.get("rating_count", 0)
    l.hourly_rate = Decimal(str(kw["hourly_rate"])) if kw.get("hourly_rate") else None
    l.bio = kw.get("bio")
    l.is_verified = kw.get("is_verified", False)
    l.summary = kw.get("summary", "")
    return l


_SEED_LAWYERS: list[Lawyer] = [
    _lawyer(
        full_name="Priya Sharma",
        bar_council_id="BAR-DL-2015-001",
        practice_areas=["Corporate Law", "Contract Disputes", "Mergers & Acquisitions"],
        jurisdictions=["Delhi", "Haryana", "Uttar Pradesh"],
        years_experience=12,
        languages=["English", "Hindi"],
        rating="4.8",
        rating_count=145,
        hourly_rate=3500,
        is_verified=True,
        summary=(
            "Senior corporate counsel with 12 years of experience in M&A, commercial contracts, "
            "and corporate governance. Handled over 50 cross-border transactions."
        ),
    ),
    _lawyer(
        full_name="Arjun Mehta",
        bar_council_id="BAR-MH-2018-042",
        practice_areas=["Criminal Law", "Bail Applications", "Criminal Appeals"],
        jurisdictions=["Maharashtra", "Gujarat"],
        years_experience=8,
        languages=["English", "Hindi", "Marathi"],
        rating="4.6",
        rating_count=89,
        hourly_rate=2000,
        is_verified=True,
        summary=(
            "Criminal defense specialist with expertise in bail applications, trials, and High Court "
            "appeals. Strong track record in economic offences and white-collar crime."
        ),
    ),
    _lawyer(
        full_name="Kavitha Nair",
        bar_council_id="BAR-KL-2012-008",
        practice_areas=["Family Law", "Divorce", "Child Custody", "Matrimonial Disputes"],
        jurisdictions=["Kerala", "Karnataka", "Tamil Nadu"],
        years_experience=15,
        languages=["English", "Malayalam", "Kannada"],
        rating="4.9",
        rating_count=203,
        hourly_rate=2500,
        is_verified=True,
        summary=(
            "Family law expert with 15 years of practice in matrimonial disputes, divorce proceedings, "
            "and child custody matters across South India."
        ),
    ),
    _lawyer(
        full_name="Rajesh Kumar",
        bar_council_id="BAR-TN-2016-031",
        practice_areas=["Consumer Protection", "Banking Law", "Real Estate"],
        jurisdictions=["Tamil Nadu", "Andhra Pradesh", "Telangana"],
        years_experience=10,
        languages=["English", "Tamil", "Telugu"],
        rating="4.5",
        rating_count=67,
        hourly_rate=1800,
        is_verified=True,
        summary=(
            "Specialises in consumer disputes, banking litigation, and property matters. "
            "Active before the National Consumer Disputes Redressal Commission."
        ),
    ),
    _lawyer(
        full_name="Sunita Verma",
        bar_council_id="BAR-RJ-2020-015",
        practice_areas=["Labour Law", "Employment Disputes", "Service Matters"],
        jurisdictions=["Rajasthan", "Madhya Pradesh", "Delhi"],
        years_experience=6,
        languages=["English", "Hindi", "Rajasthani"],
        rating="4.3",
        rating_count=34,
        hourly_rate=1500,
        is_verified=False,
        summary=(
            "Labour and employment lawyer focused on wrongful termination, provident fund disputes, "
            "and service matter appeals before the Central Administrative Tribunal."
        ),
    ),
]

# ---------------------------------------------------------------------------
# In-memory fake session — no Postgres needed
# ---------------------------------------------------------------------------


class _FakeResult:
    def __init__(self, items: list) -> None:
        self._items = items

    def fetchall(self) -> list:
        return []  # raw SQL always returns empty → LawyerRepository falls back to ORM query

    def scalars(self) -> "_FakeResult":
        return self

    def all(self) -> list:
        return self._items

    def scalar_one_or_none(self):
        return self._items[0] if self._items else None


class _FakeSession:
    """Minimal AsyncSession stand-in backed by in-memory lawyer list."""

    def __init__(self, lawyers: list[Lawyer]) -> None:
        self._lawyers = lawyers

    async def execute(self, stmt) -> _FakeResult:
        from sqlalchemy.sql.elements import TextClause

        if isinstance(stmt, TextClause):
            # PostgreSQL JSONB ?| operator — return empty so repo uses ORM fallback
            return _FakeResult([])

        # For any ORM select, hand back the whole in-memory list.
        # LawyerRepository applies .limit() server-side; we honour it here.
        try:
            limit = stmt._limit_clause.value if stmt._limit_clause is not None else None
        except AttributeError:
            limit = None

        items = list(self._lawyers)
        if limit is not None:
            items = items[:limit]
        return _FakeResult(items)

    def add(self, obj: Lawyer) -> None:
        self._lawyers.append(obj)

    async def flush(self) -> None:
        pass

    async def commit(self) -> None:
        pass

    async def refresh(self, obj) -> None:
        pass


async def _get_fake_session():  # type: ignore[override]
    yield _FakeSession(_SEED_LAWYERS)


app.dependency_overrides[get_async_session] = _get_fake_session

if __name__ == "__main__":
    import uvicorn

    print("Lawyer Marketplace (native/dev) http://localhost:8010/docs")
    uvicorn.run(app, host="0.0.0.0", port=8010, log_level="info")
