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
    # Only return chunks marked public (the curated legal corpus).
    search_enforce_visibility: bool = True
    # Drop hits whose dense cosine similarity to the query is below this (0 = off).
    # Calibrate against the loaded corpus with scripts/eval_rag.py.
    search_min_dense_score: float = 0.0


@lru_cache
def get_settings() -> SearchSettings:
    return SearchSettings()
