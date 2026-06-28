"""Adapters mapping shared clients onto the search ports."""

from __future__ import annotations

from typing import Any

from legalos_common.clients import OpenSearchClient, QdrantVectorClient
from legalos_common.rag.filters import SearchFilters
from legalos_common.search.filter_builder import build_qdrant_filter


class QdrantSearchAdapter:
    def __init__(self, client: QdrantVectorClient) -> None:
        self._client = client

    async def search(
        self, vector: list[float], *, limit: int, filters: SearchFilters | None
    ) -> list[dict[str, Any]]:
        return await self._client.search(
            vector, limit=limit, query_filter=build_qdrant_filter(filters)
        )


class OpenSearchAdapter:
    def __init__(self, client: OpenSearchClient) -> None:
        self._client = client

    async def search(
        self, query: str, *, size: int, filters: SearchFilters | None
    ) -> list[dict[str, Any]]:
        return await self._client.search(query, size=size, filters=filters)
