"""Heuristic lawyer match scoring — same factors as the marketplace UI."""

from __future__ import annotations

from app.infrastructure.lawyer_model import Lawyer


def score_lawyer(
    lawyer: Lawyer,
    *,
    practice_areas: list[str] | None = None,
    city: str | None = None,
    query: str | None = None,
) -> int:
    score = 58.0
    score += (float(lawyer.rating) - 4) * 18
    score += min(lawyer.rating_count, 150) / 25
    score += min(lawyer.years_experience, 20) * 0.6
    if lawyer.is_verified:
        score += 8
    areas = list(lawyer.practice_areas or [])
    if practice_areas:
        hits = sum(1 for a in practice_areas if a in areas)
        score += (hits / len(practice_areas)) * 16
    if city and (lawyer.city == city or any(city.lower() in str(j).lower() for j in lawyer.jurisdictions or [])):
        score += 10
    q = (query or "").strip().lower()
    if q:
        blob = " ".join(
            [
                lawyer.full_name,
                lawyer.city or "",
                lawyer.bio or "",
                " ".join(areas),
            ]
        ).lower()
        if q in blob:
            score += 6
    return max(42, min(99, round(score)))
