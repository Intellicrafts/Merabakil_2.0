import random
import asyncio
import logging

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"
]

def get_random_user_agent() -> str:
    return random.choice(USER_AGENTS)

async def random_sleep(min_seconds: float = 1.0, max_seconds: float = 3.0):
    """Sleep for a random amount of time to simulate human behavior."""
    sleep_time = random.uniform(min_seconds, max_seconds)
    logger.debug(f"Sleeping for {sleep_time:.2f}s...")
    await asyncio.sleep(sleep_time)

def get_launch_args() -> list:
    """Return hardened launch arguments for Lambda/Headless + Stealth."""
    return [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--no-sandbox",
        "--no-zygote",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-sync",
        "--disable-translate",
        "--mute-audio",
        "--no-first-run",
        "--safebrowsing-disable-auto-update",
        "--disable-blink-features=AutomationControlled", # Key for stealth
        # Memory / Resource Optimizations for Lambda
        "--disable-gl-drawing-for-tests",
        "--disable-canvas-aa",
        "--disable-2d-canvas-clip-aa", 
        "--disable-accelerated-2d-canvas",
        "--renderer-process-limit=1",
        "--disable-software-rasterizer",
        # Minimal Disk Usage
        "--disk-cache-size=1", 
        "--media-cache-size=1",
        "--disable-application-cache",
        "--disable-offline-load-stale-cache",
        "--disable-gpu-shader-disk-cache",
        "--disable-component-update"
    ]

async def stealth_click(page, selector: str):
    """
    Move mouse to element with human-like movement and then standard click.
    """
    try:
        # Wait for element
        element = await page.wait_for_selector(selector, state="visible", timeout=30000)
        if not element:
            logger.warning(f"Element {selector} not found for stealth click")
            return

        box = await element.bounding_box()
        if box:
            # Target a random point within the element
            target_x = box["x"] + random.uniform(5, box["width"] - 5)
            target_y = box["y"] + random.uniform(5, box["height"] - 5)
            
            # Move with steps to simulate human speed (variable)
            steps = random.randint(15, 40)
            await page.mouse.move(target_x, target_y, steps=steps)
            
            # Small pause before click
            await random_sleep(0.1, 0.3)
            
            # Perform standard click (more reliable than raw mouse events)
            await element.click()
        else:
            await page.click(selector)
    except Exception as e:
        logger.warning(f"Stealth click failed for {selector}: {e}")
        # Fallback
        await page.click(selector)

async def stealth_fill(page, selector: str, value: str):
    """
    Move mouse to element, click, and type with variable delay.
    """
    await stealth_click(page, selector)
    
    # Type with random delay between keystrokes
    for char in value:
        await page.keyboard.type(char, delay=random.randint(50, 150))
