"""Thin async HTTP client for billing service — chatbot usage checks and deductions."""
from __future__ import annotations

import logging
from decimal import Decimal, InvalidOperation

import httpx

logger = logging.getLogger(__name__)


class BillingClient:
    def __init__(self, base_url: str, internal_secret: str) -> None:
        self._base = base_url.rstrip("/")
        self._secret = internal_secret

    async def has_balance(self, *, user_token: str, minimum: Decimal) -> bool:
        """True when the user's wallet covers ``minimum``.

        Fails open (True) if billing itself is unreachable, so a billing outage
        doesn't take chat down with it; the deduction is still attempted after.
        """
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(
                    f"{self._base}/api/v1/wallet/me",
                    headers={"Authorization": f"Bearer {user_token}"},
                )
            if resp.status_code != 200:
                logger.warning("billing_balance_check_unavailable status=%s", resp.status_code)
                return True
            return Decimal(str(resp.json().get("balance", "0"))) >= minimum
        except (httpx.HTTPError, InvalidOperation, ValueError) as exc:
            logger.warning("billing_balance_check_failed error=%s", type(exc).__name__)
            return True

    async def deduct_chatbot_query(
        self,
        *,
        user_id: str,
        fee: Decimal,
        session_id: str | None = None,
        description: str = "AI legal assistant query",
    ) -> bool:
        """Deduct the usage fee. Never raises; returns True when charged."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self._base}/internal/wallet/deduct",
                    json={
                        "user_id": user_id,
                        "amount": str(fee),
                        "transaction_type": "CHATBOT_USAGE",
                        "description": description,
                        "reference_id": session_id,
                    },
                    headers={"X-Internal-Secret": self._secret},
                )
            if resp.status_code == 402:
                logger.warning("chatbot_billing_insufficient_funds user_id=%s", user_id)
                return False
            resp.raise_for_status()
            return True
        except Exception as exc:
            logger.warning("chatbot_billing_failed user_id=%s error=%s", user_id, exc)
            return False
