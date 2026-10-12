import logging
from typing import Any, Dict

from app.services.roll_index.punjab_haryana import (
    ACTIVE,
    DECEASED,
    REMOVED,
    SUSPENDED,
    RollIndex,
    is_bcph_enrollment,
    normalize_enrollment,
)
from app.services.scrapers.base_scraper import BaseScraper

logger = logging.getLogger(__name__)

_BLOCKED = {
    SUSPENDED: "Bar Council of Punjab & Haryana records show this enrolment as suspended.",
    DECEASED: "Bar Council of Punjab & Haryana records show this advocate as deceased.",
    REMOVED: "Bar Council of Punjab & Haryana records show this enrolment as removed from the roll.",
}


class PunjabHaryanaVerifier(BaseScraper):
    """Punjab, Haryana and Chandigarh — one Bar Council with no live search, so
    this checks the index built from its published roll and voter lists."""

    def __init__(self, index: RollIndex | None = None) -> None:
        self.index = index or RollIndex()

    async def verify(self, enrollment_number: str) -> Dict[str, Any]:
        number = normalize_enrollment(enrollment_number)
        if not is_bcph_enrollment(number):
            return {
                "status": "failed",
                "message": "Invalid enrolment number format. Expected P/1234/2010 or PH/1234/2020.",
                "data": {},
            }
        if not self.index.available():
            logger.error("ph_index_missing path=%s", self.index.path)
            return {"status": "error", "message": "Punjab & Haryana verification is temporarily unavailable."}

        record = self.index.lookup(number)
        meta = self.index.meta()
        if record is None:
            # Recent enrolments are not in the published lists yet — not a rejection.
            return {
                "status": "not_found",
                "message": "Not found in the Bar Council of Punjab & Haryana's published lists.",
                "data": {"enrollment_number": number, "index_built_at": meta.get("built_at", "")},
            }
        if record["status"] in _BLOCKED:
            return {"status": "failed", "message": _BLOCKED[record["status"]], "data": {}}

        data = {
            "enrollment_number": number,
            "name": record["name"],
            "place_of_practice": record["place_of_practice"],
            "district": record["district"],
            "state": record["state"] or "Punjab & Haryana",
            "bar_council": "Bar Council of Punjab & Haryana",
            "source": "bcph_published_lists",
            "sources": record["sources"],
            "index_built_at": meta.get("built_at", ""),
        }
        if record["status"] != ACTIVE:
            # An unrecognised remark on BCPH's list — let a person decide.
            return {
                "status": "not_found",
                "message": f"Bar Council record has a remark: {record['status_raw']}",
                "data": data,
            }
        return {"status": "success", "data": data}
