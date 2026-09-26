from __future__ import annotations

from functools import lru_cache

from pydantic import model_validator

from legalos_common.config import CommonSettings

_DEFAULT_SECRET = "change-me"


class BillingSettings(CommonSettings):
    service_name: str = "billing-service"
    billing_internal_secret: str = _DEFAULT_SECRET
    welcome_credit_inr: str = "100.00"
    chatbot_query_fee_inr: str = "0.10"
    # Unpaid self top-up (POST /wallet/me/top-up). Off until payments are verified.
    wallet_self_topup_enabled: bool = False

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> "BillingSettings":
        # The internal wallet routes trust this header alone; a default value
        # would let anyone credit wallets.
        if self.environment == "production" and (
            self.billing_internal_secret == _DEFAULT_SECRET
            or len(self.billing_internal_secret) < 32
        ):
            raise ValueError(
                "BILLING_INTERNAL_SECRET must be set to a strong value (>=32 chars) in production"
            )
        return self


@lru_cache
def get_settings() -> BillingSettings:
    return BillingSettings()
