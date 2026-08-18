from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class ResearchSettings(CommonSettings):
    service_name: str = "research-service"
    retrieval_top_k: int = 8
    search_timeout_seconds: float = 30.0

    # Memory — reuses platform Redis (redis_url from CommonSettings) and Qdrant
    session_ttl_seconds: int = 7200
    session_max_turns: int = 10
    qdrant_ltm_collection: str = "legalos_user_ltm"
    ltm_dedup_threshold: float = 0.92


@lru_cache
def get_settings() -> ResearchSettings:
    return ResearchSettings()
