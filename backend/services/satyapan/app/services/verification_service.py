from typing import Any, Dict

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


def supported_states() -> list[str]:
    return list(BAR_COUNCILS)


class VerificationService:
    async def verify_lawyer(self, enrollment_number: str, state: str) -> Dict[str, Any]:
        key = (state or "").strip().lower()
        for verifier, aliases in BAR_COUNCILS.values():
            if key in aliases:
                return await verifier().verify(enrollment_number)
        raise ValueError(f"Verification for state '{state}' is not supported yet.")
