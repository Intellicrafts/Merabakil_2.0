"""Thin async HTTP client for billing service internal endpoints."""
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

    def _headers(self) -> dict[str, str]:
        return {"X-Internal-Secret": self._secret}

    async def deduct_for_booking(
        self,
        *,
        user_id: uuid.UUID,
        amount: Decimal,
        consultation_id: uuid.UUID,
    ) -> None:
        """Raises httpx.HTTPStatusError (status 402) if insufficient funds."""
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{self._base}/internal/wallet/deduct",
                json={
                    "user_id": str(user_id),
                    "amount": str(amount),
                    "transaction_type": "APPOINTMENT_BOOKING",
                    "description": f"Consultation booking {consultation_id}",
                    "reference_id": str(consultation_id),
                },
                headers=self._headers(),
            )
            resp.raise_for_status()

    async def credit_refund(
        self,
        *,
        user_id: uuid.UUID,
        amount: Decimal,
        consultation_id: uuid.UUID,
    ) -> None:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self._base}/internal/wallet/credit",
                    json={
                        "user_id": str(user_id),
                        "amount": str(amount),
                        "transaction_type": "APPOINTMENT_REFUND",
                        "description": f"Refund for cancelled consultation {consultation_id}",
                        "reference_id": str(consultation_id),
                    },
                    headers=self._headers(),
                )
                resp.raise_for_status()
        except Exception as exc:
            logger.warning("billing_refund_failed consultation_id=%s error=%s", consultation_id, exc)

    async def credit_advocate_earning(
        self,
        *,
        advocate_user_id: uuid.UUID,
        amount: Decimal,
        consultation_id: uuid.UUID,
    ) -> None:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self._base}/internal/wallet/credit",
                    json={
                        "user_id": str(advocate_user_id),
                        "amount": str(amount),
                        "transaction_type": "ADVOCATE_EARNING",
                        "description": f"Earning from completed consultation {consultation_id}",
                        "reference_id": str(consultation_id),
                    },
                    headers=self._headers(),
                )
                resp.raise_for_status()
        except Exception as exc:
            logger.warning(
                "billing_advocate_earning_failed consultation_id=%s error=%s",
                consultation_id,
                exc,
            )
