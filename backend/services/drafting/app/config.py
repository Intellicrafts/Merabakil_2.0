from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class DraftingSettings(CommonSettings):
    service_name: str = "drafting-service"


@lru_cache
def get_settings() -> DraftingSettings:
    return DraftingSettings()
