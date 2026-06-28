from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class LitigationSettings(CommonSettings):
    service_name: str = "litigation-service"


@lru_cache
def get_settings() -> LitigationSettings:
    return LitigationSettings()
