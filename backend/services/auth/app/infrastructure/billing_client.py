"""Fire-and-forget billing client — initialises wallet on new user registration."""
from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)


class BillingClient:
    def __init__(self, base_url: str, internal_secret: str) -> None:
        self._base = base_url.rstrip("/")
        self._secret = internal_secret

    async def init_wallet(self, *, user_id: str) -> None:
        """Create wallet and credit the ₹100 welcome bonus. Never raises."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self._base}/internal/wallet/init",
                    json={"user_id": user_id},
                    headers={"X-Internal-Secret": self._secret},
                )
                resp.raise_for_status()
                logger.info("wallet.init_ok user_id=%s", user_id)
        except Exception as exc:
            logger.warning("wallet.init_failed user_id=%s error=%s", user_id, exc)
