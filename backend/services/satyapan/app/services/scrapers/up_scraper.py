from typing import Dict, Any
from app.services.scrapers.base_scraper import BaseScraper
from app.core.config import settings
from playwright.async_api import async_playwright

from app.core.stealth import random_sleep, stealth_click, stealth_fill
import logging

logger = logging.getLogger(__name__)

class UPScraper(BaseScraper):
    async def verify(self, enrollment_number: str) -> Dict[str, Any]:
        logger.info(f"Starting verification for UP: {enrollment_number}")
        async with async_playwright() as p:
            logger.info("Launching browser...")
            browser, context, page = await self.launch_stealth_browser(p)
            
            try:
                url = settings.URLS.get("uttar_pradesh")
                await page.goto(url, timeout=60000)
                await random_sleep(1, 2)
                
                # Input Enrollment Number
                await stealth_fill(page, "#ContentPlaceHolder1_txtEnrollment", enrollment_number)
                await random_sleep(0.5, 1.5)
                
                # Click Search
                # Updated selector based on debugging: #ContentPlaceHolder1_btnNew
                if await page.query_selector("#ContentPlaceHolder1_btnNew"):
                    await stealth_click(page, "#ContentPlaceHolder1_btnNew")
                else:
                    await stealth_click(page, "#ContentPlaceHolder1_btnSearch")
                
                # Wait for results or error
                # We wait for the table to appear OR an error message
                # The result table is inside ContentPlaceHolder1_DlAdvocateOnRoll
                try:
                    await page.wait_for_selector("#ContentPlaceHolder1_DlAdvocateOnRoll", timeout=10000)
                except:
                    # If table doesn't appear, check for valid/invalid message if possible, or return not found
                     return {
                        "status": "failed",
                        "message": "Record not found or timeout waiting for results.",
                        "data": {}
                    }

                # Extract Details
                # Helper function to get text safely
                async def get_text(selector):
                    try:
                        return await page.inner_text(selector)
                    except:
                        return None

                # Using the structural selectors found
                # Note: The table structure is nested.
                # Row 1: Enroll No
                # Row 2: Name
                # Row 3: Father Name
                # Row 4: Address
                # Row 5: District
                # Row 6: Date of Enrollment
                # Row 7: Date of Transfer
                # Row 8: DOB
                # Row 9: Date of TR
                
                base_table_selector = "#ContentPlaceHolder1_DlAdvocateOnRoll table table"
                
                async def get_row_text(row_index):
                    try:
                        # Row indices seem to be sequential in the nested table
                        return await page.inner_text(f"{base_table_selector} tr:nth-of-type({row_index}) td:nth-of-type(2)")
                    except Exception:
                        return None

                data = {
                    "enrollment_number": enrollment_number,
                    "name": await get_row_text(2),
                    "father_name": await get_row_text(3),
                    "address": await get_row_text(4),
                    "district": await get_row_text(5),
                    "enrollment_date": await get_row_text(6),
                    "transfer_date": await get_row_text(7),
                    "dob": await get_row_text(8),
                    "tr_date": await get_row_text(9),
                    "state": "Uttar Pradesh"
                }

                # Filter out None values and valid/invalid status if possible
                return {
                    "status": "success",
                    "data": data
                }
                
            except Exception as e:
                return {
                    "status": "error",
                    "message": str(e)
                }
            finally:
                await browser.close()
