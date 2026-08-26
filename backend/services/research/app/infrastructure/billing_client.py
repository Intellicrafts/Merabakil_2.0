"""Thin async HTTP client for billing service — chatbot usage deduction."""
from __future__ import annotations

import logging
import uuid
from decimal import Decimal

import httpx

logger = logging.getLogger(__name__)


class BillingClient:
    def __init__(self, base_url: str, internal_secret: str) -> None:
        self._base = base_url.rstrip("/")
        self._secret = internal_secret

    async def deduct_chatbot_query(self, *, user_id: str, fee: Decimal) -> None:
        """Fire-and-forget: deduct chatbot usage fee. Never raises."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.post(
                    f"{self._base}/internal/wallet/deduct",
                    json={
                        "user_id": user_id,
                        "amount": str(fee),
                        "transaction_type": "CHATBOT_USAGE",
                        "description": "AI legal assistant query",
                        "reference_id": None,
                    },
                    headers={"X-Internal-Secret": self._secret},
                )
                if resp.status_code == 402:
                    logger.debug("chatbot_billing_insufficient_funds user_id=%s", user_id)
                else:
                    resp.raise_for_status()
        except Exception as exc:
            logger.debug("chatbot_billing_failed user_id=%s error=%s", user_id, exc)
