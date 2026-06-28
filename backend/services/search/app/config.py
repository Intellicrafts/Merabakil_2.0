from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class SearchSettings(CommonSettings):
    service_name: str = "search-service"
    rrf_k: int = 60
    default_top_k: int = 10
    candidate_multiplier: int = 3  # over-fetch before re-ranking
    search_cache_ttl_seconds: int = 600
    search_cache_enabled: bool = True


@lru_cache
def get_settings() -> SearchSettings:
    return SearchSettings()
