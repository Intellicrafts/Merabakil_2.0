from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class BillingSettings(CommonSettings):
    service_name: str = "billing-service"
    billing_internal_secret: str = "change-me"
    welcome_credit_inr: str = "100.00"
    chatbot_query_fee_inr: str = "2.00"


@lru_cache
def get_settings() -> BillingSettings:
    return BillingSettings()
