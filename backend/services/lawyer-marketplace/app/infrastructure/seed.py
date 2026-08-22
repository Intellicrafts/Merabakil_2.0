"""Ensure the demo advocate listing exists; hide leftover fake catalog rows."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import ADVOCATE_USER_ID, PRIYA_LAWYER_ID, PRIYA_SLUG
from app.infrastructure.lawyer_model import Lawyer

LEGACY_DEMO_SLUGS = {
    "lw-002",
    "lw-003",
    "lw-004",
    "lw-005",
    "lw-006",
    "lw-007",
    "lw-009",
    "lw-010",
    "lw-012",
}


async def seed_lawyers(session: AsyncSession) -> int:
    """Upsert Adv. Priya Sharma and unverify leftover mock catalog rows."""
    leftover = list(
        (await session.execute(select(Lawyer).where(Lawyer.slug.in_(LEGACY_DEMO_SLUGS)))).scalars()
    )
    for row in leftover:
        if row.user_id != ADVOCATE_USER_ID:
            row.is_verified = False

    existing = await session.get(Lawyer, PRIYA_LAWYER_ID)
    if existing is None:
        by_user = await session.execute(select(Lawyer).where(Lawyer.user_id == ADVOCATE_USER_ID))
        existing = by_user.scalar_one_or_none()

    if existing is None:
        session.add(
            Lawyer(
                id=PRIYA_LAWYER_ID,
                user_id=ADVOCATE_USER_ID,
                slug=PRIYA_SLUG,
                full_name="Adv. Priya Sharma",
                bar_council_id="D/1234/2012",
                practice_areas=["Criminal", "Constitutional"],
                city="Delhi",
                jurisdictions=["Delhi", "Supreme Court"],
                languages=["English", "Hindi"],
                years_experience=14,
                rating=Decimal("4.9"),
                rating_count=128,
                is_verified=True,
                hourly_rate=Decimal("4500"),
                bio="Senior criminal and constitutional counsel with extensive Supreme Court and Delhi High Court practice.",
                summary="Senior criminal and constitutional counsel with extensive Supreme Court and Delhi High Court practice.",
            )
        )
        await session.flush()
        return 1

    existing.user_id = ADVOCATE_USER_ID
    existing.slug = existing.slug or PRIYA_SLUG
    existing.full_name = existing.full_name or "Adv. Priya Sharma"
    existing.is_verified = True
    if not existing.city:
        existing.city = "Delhi"
    if not existing.practice_areas:
        existing.practice_areas = ["Criminal", "Constitutional"]
    await session.flush()
    return 0
