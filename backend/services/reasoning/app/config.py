from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class ReasoningSettings(CommonSettings):
    service_name: str = "reasoning-service"


@lru_cache
def get_settings() -> ReasoningSettings:
    return ReasoningSettings()
