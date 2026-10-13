"""What an advocate's listing must contain — one definition for the save
endpoints (advocate and admin), the serialized listing status and the UI.

A listing with a consultation fee is one the advocate wants clients to book,
so it must be complete. Without a fee (part-way through setup) any subset of
details can be saved.
"""

from __future__ import annotations

import re
from datetime import datetime
from zoneinfo import ZoneInfo

from app.application.bar_councils import council_for_state, pincode_in_council

IST = ZoneInfo("Asia/Kolkata")
PINCODE_RE = re.compile(r"^[1-9][0-9]{5}$")
_PLACEHOLDER_NAMES = {"", "advocate"}

FIELD_MESSAGES = {
    "full_name": "Enter the name clients should see.",
    "bar_council_id": "Enter your Bar Council enrolment number.",
    "pincode": "Enter a valid 6-digit pincode.",
    "city": "Enter your city.",
    "location_state": "Choose your state.",
    "years_experience": "Enter your years of experience.",
    "practice_areas": "Choose at least one practice area.",
    "jurisdictions": "Choose at least one court.",
    "hourly_rate": "Enter your consultation fee.",
}


def current_year() -> int:
    return datetime.now(IST).year


def practising_since_for(years: int) -> int:
    return current_year() - years


def experience_years(lawyer) -> int:
    """Years of experience, kept current by the year practice began. Rows saved
    before that existed fall back to the stored number."""
    since = getattr(lawyer, "practising_since", None)
    if since is not None:
        return max(0, current_year() - int(since))
    return int(getattr(lawyer, "years_experience", 0) or 0)


def experience_provided(lawyer) -> bool:
    """0 years is a real answer ("less than a year") once practising_since is
    set; for older rows 0 only ever meant "not filled in"."""
    return getattr(lawyer, "practising_since", None) is not None or (
        getattr(lawyer, "years_experience", 0) or 0
    ) > 0


def missing_required(lawyer) -> list[str]:
    """Mandatory details not yet on the listing (field names as in the API)."""
    checks = [
        ("full_name", (lawyer.full_name or "").strip().lower() not in _PLACEHOLDER_NAMES),
        ("bar_council_id", bool((lawyer.bar_council_id or "").strip())),
        ("pincode", bool(PINCODE_RE.match(lawyer.pincode or ""))),
        ("city", bool((lawyer.city or "").strip())),
        ("location_state", bool((lawyer.location_state or "").strip())),
        ("years_experience", experience_provided(lawyer)),
        ("practice_areas", bool(lawyer.practice_areas)),
        ("jurisdictions", bool(lawyer.jurisdictions)),
        ("hourly_rate", (lawyer.hourly_rate or 0) > 0),
    ]
    return [name for name, ok in checks if not ok]


def completeness_errors(profile) -> dict[str, str]:
    """For a profile with a consultation fee: each missing detail and what to do."""
    if not (profile.hourly_rate or 0) > 0:
        return {}
    return {name: FIELD_MESSAGES[name] for name in missing_required(profile) if name != "hourly_rate"}


def office_errors(pincode: str | None, state: str | None) -> dict[str, str]:
    """The office pincode must be in the office state — the state decides which
    Bar Council checks the enrolment (e.g. a UP pincode can't be filed under Punjab)."""
    council = council_for_state(state)
    if council and pincode and not pincode_in_council(pincode, council):
        return {"pincode": f"This pincode isn't in {state}. Check the pincode and the state."}
    return {}
