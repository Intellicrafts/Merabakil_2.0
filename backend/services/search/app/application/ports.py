from __future__ import annotations

from typing import Any, Protocol

from legalos_common.rag.filters import SearchFilters


class HybridSearchPort(Protocol):
    """Single port for Qdrant-native hybrid (dense + sparse) search."""

    async def search(
        self,
        query: str,
        vector: list[float],
        *,
        limit: int,
        filters: SearchFilters | None,
        enforce_access: bool = True,
        min_dense_score: float = 0.0,
    ) -> list[dict[str, Any]]: ...
