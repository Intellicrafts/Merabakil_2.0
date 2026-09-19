from typing import Dict, Any
from app.services.scrapers.base_scraper import BaseScraper
from app.core.config import settings
from playwright.async_api import async_playwright
from app.core.stealth import random_sleep, stealth_click, stealth_fill
import logging

logger = logging.getLogger(__name__)

class APScraper(BaseScraper):
    async def verify(self, enrollment_number: str) -> Dict[str, Any]:
        logger.info(f"Starting verification for AP: {enrollment_number}")
        
        # Valid format check (Simple)
        # Expected: AP/123/2020
        if not enrollment_number.upper().startswith("AP/"):
             return {
                "status": "failed",
                "message": "Invalid enrollment number format. Expected AP/123/2020.",
                "data": {}
            }

        async with async_playwright() as p:
            logger.info("Launching browser...")
            browser, context, page = await self.launch_stealth_browser(p)
            
            try:
                url = settings.URLS.get("andhra_pradesh")
                logger.info(f"Navigating to {url}")
                await page.goto(url, timeout=60000)
                await random_sleep(1, 2)
                
                # Input Enrollment Number
                # Selector: #enumber
                logger.info("Filling enrollment number...")
                await stealth_fill(page, "#enumber", enrollment_number)
                await random_sleep(0.5, 1.5)
                
                # Click Search
                # Selector: .search_data
                logger.info("Clicking search...")
                await stealth_click(page, ".search_data")
                
                # Wait for results
                # The results are in a div with class "res" or table with class "mmm"
                logger.info("Waiting for results...")
                try:
                    await page.wait_for_selector("div.res table", timeout=15000) 
                except:
                    logger.warning("No result table found after wait.")
                    return {
                        "status": "failed",
                        "message": "Record not found or timeout.",
                        "data": {}
                    }
                
                # Extract Data
                data = {
                    "enrollment_number": enrollment_number,
                    "state": "Andhra Pradesh",
                    "name": None,
                    "father_name": None,
                    "address": None,
                    "enrollment_date": None,
                    "status": None # New field seen in screenshot
                }

                # Strategy 1: Use specific classes if available (observed in DOM inspection)
                # Name: td.advcname
                # Address: td.advcadd
                # Enrollment No: td.enrt_no
                
                try:
                    name_el = await page.query_selector("td.advcname")
                    if name_el:
                        data["name"] = (await name_el.inner_text()).strip()
                    
                    address_el = await page.query_selector("td.advcadd")
                    if address_el:
                        data["address"] = (await address_el.inner_text()).strip()
                        
                except Exception as e:
                    logger.warning(f"Error extracting by class: {e}")

                # Strategy 2: Iterate rows for other fields or fallback
                # Structure: <tr><th>Header</th><td>Value</td></tr>
                rows = await page.query_selector_all("div.res table tr")
                
                for row in rows:
                    th = await row.query_selector("th")
                    td = await row.query_selector("td")
                    
                    if th and td:
                        header = (await th.inner_text()).strip().lower()
                        value = (await td.inner_text()).strip()
                        
                        if "name of the advocate" in header and not data["name"]:
                            data["name"] = value
                        elif "father" in header:
                            data["father_name"] = value
                        elif "address" in header and not data["address"]:
                            data["address"] = value
                        elif "date of enrollment" in header:
                            data["enrollment_date"] = value
                        elif "status" in header:
                            data["status"] = value

                return {
                    "status": "success",
                    "data": data
                }

            except Exception as e:
                logger.error(f"Error during AP verification: {str(e)}")
                return {
                    "status": "error",
                    "message": str(e)
                }
            finally:
                await browser.close()
