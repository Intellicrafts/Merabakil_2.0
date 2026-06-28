from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class ContractReviewSettings(CommonSettings):
    service_name: str = "contract-review-service"


@lru_cache
def get_settings() -> ContractReviewSettings:
    return ContractReviewSettings()
