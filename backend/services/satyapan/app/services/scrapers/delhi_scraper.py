from typing import Dict, Any
from app.services.scrapers.base_scraper import BaseScraper
from app.core.config import settings
from playwright.async_api import async_playwright

from app.core.stealth import random_sleep, stealth_click, stealth_fill
import logging

logger = logging.getLogger(__name__)

class DelhiScraper(BaseScraper):
    async def verify(self, enrollment_number: str) -> Dict[str, Any]:
        logger.info(f"Starting verification for Delhi: {enrollment_number}")
        # Format: D/105/2005 -> 105, 2005
        # Splitting manually to be safe
        try:
            parts = enrollment_number.split('/')
            if len(parts) == 3 and parts[0].upper() == 'D':
                enroll_id = parts[1]
                year = parts[2]
            elif len(parts) == 2:
                 # Handle case without prefix D/
                enroll_id = parts[0]
                year = parts[1]
            else:
                 return {
                    "status": "failed",
                    "message": "Invalid enrollment number format for Delhi. Expected D/105/2005 or 105/2005.",
                    "data": {}
                }
        except Exception:
            return {
                "status": "failed",
                "message": "Could not parse enrollment number.",
                "data": {}
            }

        max_retries = 3
        for attempt in range(max_retries):
            try:
                async with async_playwright() as p:
                    browser, context, page = await self.launch_stealth_browser(p)
                    
                    try:
                        url = settings.URLS.get("delhi")
                        await page.goto(url, timeout=60000)
                        await random_sleep(1, 2)
                        
                        # Fill input fields
                        await stealth_fill(page, 'input[name="enroll_id"]', enroll_id)
                        await stealth_fill(page, 'input[name="year"]', year)
                        await random_sleep(0.5, 1.5)
                        
                        # Click Search
                        await stealth_click(page, 'input[name="search-by-enroll-id"]')
                        
                        # Wait for results
                        try:
                            await page.wait_for_selector("#first_name", timeout=10000)
                        except:
                            # Verify if maybe an alert or error appeared
                            # For now, just assume not found if timeout
                            return {
                                "status": "failed",
                                "message": "Record not found or timeout.",
                                "data": {}
                            }

                        # Extract Data from Input Fields (readonly)
                        # Helper to safely get value
                        async def get_val(selector: str):
                            try:
                                return await page.input_value(selector, timeout=1000)
                            except:
                                return None
        
                        # Helper to safely get value by XPath
                        async def get_val_by_xpath(xpath: str):
                            try:
                                return await page.locator(xpath).first.input_value(timeout=1000)
                            except:
                                return None
        
                        data = {
                            "enrollment_number": enrollment_number,
                            "name": await get_val("#first_name"),
                            "father_name": await get_val("#relative_name"),
                            "address": await get_val('textarea[name="c_address"]'),
                            "mobile_no": await get_val('input[name="mobile1"]'),
                            "email": await get_val('input[name="email"]'), 
                            "dob": await get_val('input[name="dob"]'),
                            "enrollment_date": await get_val('input[name="p_phone2"]'),
                            "remarks": await get_val('textarea[name="p_phone1"]'),
                            "degree_year": await get_val('input[name="c_phone1"]'),
                            "degree_date": await get_val('input[name="category"]'),
                            
                            # Extended Fields
                            "aibe_applicable": await get_val_by_xpath("//label[contains(., 'AIBE Applicable')]/..//input"),
                            "llb_verification_remarks": await get_val_by_xpath("//label[normalize-space()='LLB Verification']/..//textarea"),
                            "llb_verification_status": await get_val_by_xpath("//label[normalize-space()='LLB Verification']/..//input"),
                            "decl_form": await get_val_by_xpath("//label[contains(., 'Decl Form')]/..//input"),
                            "transfer_to": await get_val_by_xpath("//label[contains(., 'Transfer To')]/..//input"),
                            "transfer_from": await get_val_by_xpath("//label[contains(., 'Transfer From')]/..//input"),
                            "fake": await get_val_by_xpath("//label[contains(., 'Fake')]/..//input"),
                            "licence_removed": await get_val_by_xpath("//label[contains(., 'Licence Removed')]/..//input"),
                            "licence_cancelled": await get_val_by_xpath("//label[contains(., 'Licence Cancelled')]/..//input"),
                            "suspence": await get_val_by_xpath("//label[contains(., 'Suspence')]/..//input"),
                            "state": "Delhi"
                        }
                        
                        return {
                            "status": "success",
                            "data": data 
                        }
                        
                    except Exception as e:
                        logger.warning(f"Attempt {attempt + 1} failed for {enrollment_number}: {e}")
                        if attempt == max_retries - 1:
                            raise e # Re-raise if last attempt
                    finally:
                        await browser.close()

            except Exception as e:
                if attempt == max_retries - 1:
                    return {
                        "status": "error",
                        "message": str(e)
                    }
                await random_sleep(2, 5) # Backoff before retry
