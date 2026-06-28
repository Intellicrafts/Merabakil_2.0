from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class ResearchSettings(CommonSettings):
    service_name: str = "research-service"
    retrieval_top_k: int = 8
    search_timeout_seconds: float = 30.0


@lru_cache
def get_settings() -> ResearchSettings:
    return ResearchSettings()
