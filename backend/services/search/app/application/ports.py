from __future__ import annotations

from typing import Any, Protocol

from legalos_common.rag.filters import SearchFilters


class VectorSearchPort(Protocol):
    async def search(
        self, vector: list[float], *, limit: int, filters: SearchFilters | None
    ) -> list[dict[str, Any]]: ...


class KeywordSearchPort(Protocol):
    async def search(
        self, query: str, *, size: int, filters: SearchFilters | None
    ) -> list[dict[str, Any]]: ...
