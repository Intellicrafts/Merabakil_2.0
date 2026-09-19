from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseScraper(ABC):
    def _cleanup_temp(self):
        """Clean up Playwright artifacts from /tmp to prevent ENOSPC on Lambda."""
        import shutil
        import glob
        import os
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Patterns of temp directories created by Playwright/Chromium
        patterns = ["/tmp/playwright*", "/tmp/chromium*", "/tmp/scoped_dir*", "/tmp/.org.chromium.Chromium*"]
        
        # Log initial disk usage
        try:
            total, used, free = shutil.disk_usage("/tmp")
            logger.info(f"Disk Usage /tmp BEFORE cleanup: Total: {total//(1024*1024)}MB, Free: {free//(1024*1024)}MB")
        except:
            pass

        for pattern in patterns:
            for path in glob.glob(pattern):
                try:
                    if os.path.isdir(path):
                        shutil.rmtree(path, ignore_errors=True)
                        logger.info(f"Cleaned up temp dir: {path}")
                    else:
                        os.remove(path)
                        logger.info(f"Cleaned up temp file: {path}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup {path}: {e}")

        # Log final disk usage
        try:
            total, used, free = shutil.disk_usage("/tmp")
            logger.info(f"Disk Usage /tmp AFTER cleanup: Total: {total//(1024*1024)}MB, Free: {free//(1024*1024)}MB")
        except:
            pass

    async def launch_stealth_browser(self, p):
        """
        Launches a browser with stealth settings.
        Returns (browser, context, page).
        """
        from app.core.stealth import get_launch_args, get_random_user_agent
        from app.core.config import settings

        # Clean up previous artifacts to free space
        self._cleanup_temp()

        browser = await p.chromium.launch(
            headless=settings.HEADLESS,
            args=get_launch_args()
        )
        
        context = await browser.new_context(
            user_agent=get_random_user_agent(),
            viewport={"width": 1280, "height": 720}
        )
        
        # Stealth: Hide webdriver property
        await context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        page = await context.new_page()
        return browser, context, page

    @abstractmethod
    async def verify(self, enrollment_number: str) -> Dict[str, Any]:
        """
        Verify the lawyer based on enrollment number.
        Returns a dictionary with verification details.
        """
        pass
