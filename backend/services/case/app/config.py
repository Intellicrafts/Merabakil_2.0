from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class CaseSettings(CommonSettings):
    service_name: str = "case-service"


@lru_cache
def get_settings() -> CaseSettings:
    return CaseSettings()
