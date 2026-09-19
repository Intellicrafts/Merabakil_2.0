from typing import Dict, Any
from app.services.scrapers.up_scraper import UPScraper
from app.services.scrapers.delhi_scraper import DelhiScraper

from app.services.scrapers.ap_scraper import APScraper
from app.services.scrapers.rajasthan_scraper import RajasthanScraper

class VerificationService:
    async def verify_lawyer(self, enrollment_number: str, state: str) -> Dict[str, Any]:
        state_key = state.lower()
        if state_key == "uttar pradesh" or state_key == "up":
            scraper = UPScraper()
            return await scraper.verify(enrollment_number)
        elif state_key == "delhi":
            scraper = DelhiScraper()
            return await scraper.verify(enrollment_number)
        elif state_key == "andhra pradesh" or state_key == "ap":
            scraper = APScraper()
            return await scraper.verify(enrollment_number)
        elif state_key == "rajasthan" or state_key == "rj" or state_key == "r":
            scraper = RajasthanScraper()
            return await scraper.verify(enrollment_number)
        else:
            raise ValueError(f"Verification for state '{state}' is not supported yet.")
