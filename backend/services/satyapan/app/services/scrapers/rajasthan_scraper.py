from typing import Dict, Any
from app.services.scrapers.base_scraper import BaseScraper
from app.core.config import settings
from playwright.async_api import async_playwright
from app.core.stealth import random_sleep, stealth_click, stealth_fill
import logging
import asyncio

logger = logging.getLogger(__name__)

class RajasthanScraper(BaseScraper):
    async def verify(self, enrollment_number: str) -> Dict[str, Any]:
        logger.info(f"Starting verification for Rajasthan: {enrollment_number}")
        
        # Expected format: R/176A/1978 or 176A/1978
        # We need to extract the middle part (number/suffix) and the year.
        try:
            parts = enrollment_number.upper().split('/')
            if len(parts) == 3 and parts[0] == 'R':
                num = parts[1]
                year = parts[2]
            elif len(parts) == 2:
                num = parts[0]
                year = parts[1]
            else:
                 return {
                    "status": "failed",
                    "message": "Invalid enrollment number format. Expected R/176A/1978.",
                    "data": {}
                }
        except Exception:
            return {
                "status": "failed",
                "message": "Could not parse enrollment number.",
                "data": {}
            }

        async with async_playwright() as p:
            logger.info("Launching browser...")
            browser, context, page = await self.launch_stealth_browser(p)
            
            try:
                url = settings.URLS.get("rajasthan")
                logger.info(f"Navigating to {url}")
                await page.goto(url, timeout=60000)
                await random_sleep(1, 2)
                
                # Input Enrollment Number
                # Selector: #txtEnrollNo
                await stealth_fill(page, "#txtEnrollNo", num)
                
                # Input Year
                # Selector: #txtEnrollYr
                await stealth_fill(page, "#txtEnrollYr", year)
                await random_sleep(0.5, 1.5)
                
                # Click somewhere else to trigger blur/update
                # Clicking on the body
                await stealth_click(page, "body")
                # Also press Tab just in case
                await page.keyboard.press("Tab")
                
                logger.info("Waiting for results update...")
                # Wait for #lblName to have some text. 
                # Ideally we check if it's not empty, but wait_for_function is complex.
                # Let's wait a bit and then poll or check.
                # Or wait for a specific element state change if possible.
                # The site updates the text content.
                
                # Wait for up to 10 seconds for the name to populate
                for _ in range(20):
                    name = await page.inner_text("#lblName")
                    if name and name.strip():
                        break
                    await asyncio.sleep(0.5)
                
                name = (await page.inner_text("#lblName")).strip()
                if not name:
                     return {
                        "status": "failed",
                        "message": "Record not found (Name empty).",
                        "data": {}
                    }
                
                mobile = (await page.inner_text("#lblMob")).strip()
                place_of_practice = (await page.inner_text("#lblPP")).strip()
                
                data = {
                    "enrollment_number": enrollment_number,
                    "name": name,
                    "mobile_no": mobile, # Masked
                    "place_of_practice": place_of_practice, # This is the Bar Association/Council Name
                    "state": "Rajasthan"
                }

                return {
                    "status": "success",
                    "data": data
                }

            except Exception as e:
                logger.error(f"Error extracting Rajasthan data: {e}")
                return {
                    "status": "error",
                    "message": str(e)
                }
            finally:
                await browser.close()
