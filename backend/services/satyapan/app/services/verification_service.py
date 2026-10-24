from typing import Any, Dict, Optional

from app.services.roll_index.punjab_haryana import is_bcph_enrollment
from app.services.scrapers.ap_scraper import APScraper
from app.services.scrapers.delhi_scraper import DelhiScraper
from app.services.scrapers.punjab_haryana_verifier import PunjabHaryanaVerifier
from app.services.scrapers.rajasthan_scraper import RajasthanScraper
from app.services.scrapers.up_scraper import UPScraper

# Bar council → (verifier, names a caller may use). Punjab, Haryana and
# Chandigarh share one council, so all three resolve to the same verifier.
BAR_COUNCILS = {
    "Uttar Pradesh": (UPScraper, {"uttar pradesh", "up"}),
    "Delhi": (DelhiScraper, {"delhi"}),
    "Andhra Pradesh": (APScraper, {"andhra pradesh", "ap"}),
    "Rajasthan": (RajasthanScraper, {"rajasthan", "rj", "r"}),
    "Punjab & Haryana": (
        PunjabHaryanaVerifier,
        {"punjab & haryana", "punjab and haryana", "punjab", "haryana", "chandigarh", "ph"},
    ),
}

# Enrolment-number prefixes per council — how the number itself names its council.
# Mirrors lawyer-marketplace `_detect_bar_council_state` and the frontend
# `detectBarCouncil` (src/lib/bar-councils.ts); keep the three in step.
COUNCIL_PREFIXES: dict[str, tuple[str, ...]] = {
    "Uttar Pradesh": ("UP",),
    "Delhi": ("D/",),
    "Andhra Pradesh": ("AP/",),
    "Rajasthan": ("R/",),
    "Punjab & Haryana": ("P/", "PH/", "P-", "PH-"),
}


def supported_states() -> list[str]:
    return list(BAR_COUNCILS)


def detect_council(enrollment_number: str) -> Optional[str]:
    """The Bar Council an enrolment number belongs to, from its prefix (None if unknown).

    e.g. "UP1234/2010" → Uttar Pradesh, "D/105/2005" → Delhi, "PH/1/2026" → Punjab & Haryana.
    """
    en = (enrollment_number or "").upper().strip()
    if not en:
        return None
    for council, prefixes in COUNCIL_PREFIXES.items():
        if en.startswith(prefixes):
            return council
    # Punjab & Haryana numbers also come with spaces/dashes (e.g. "PH 1234 2020").
    if is_bcph_enrollment(en):
        return "Punjab & Haryana"
    return None


def council_for_state(state: Optional[str]) -> Optional[str]:
    """Match a caller-supplied state/alias string to a Bar Council key (None if unknown)."""
    key = (state or "").strip().lower()
    if not key:
        return None
    for council, (_verifier, aliases) in BAR_COUNCILS.items():
        if key == council.lower() or key in aliases:
            return council
    return None


class VerificationService:
    async def verify_lawyer(
        self, enrollment_number: str, state: Optional[str] = None
    ) -> Dict[str, Any]:
        # The enrolment number itself decides the council; an explicit `state` is
        # only a fallback for numbers whose prefix we don't recognise.
        council = detect_council(enrollment_number) or council_for_state(state)
        if council is None:
            raise ValueError(
                f"Could not determine the State Bar Council from enrolment "
                f"'{enrollment_number}'. Supported: {', '.join(supported_states())}."
            )
        verifier, _aliases = BAR_COUNCILS[council]
        return await verifier().verify(enrollment_number)
