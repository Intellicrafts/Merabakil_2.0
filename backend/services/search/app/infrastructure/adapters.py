"""Adapters mapping Qdrant client onto the HybridSearchPort with parent context expansion."""

from __future__ import annotations

from typing import Any

from legalos_common.clients import QdrantVectorClient
from legalos_common.rag.filters import SearchFilters
from legalos_common.search.filter_builder import build_qdrant_filter
from legalos_common.search.sparse_encoder import SparseEncoder


class QdrantHybridAdapter:
    """HybridSearchPort: searches children, then expands results with parent context.

    Flow (matches shared 'Converstation Chat Bot' architecture):
      1. Hybrid search children collection (dense + sparse RRF via Qdrant)
      2. Collect parent_ids from matching children
      3. Batch-fetch parents from parents collection
      4. Return hits with parent.content replacing child.content so the LLM
         receives full context (~1024 chars) while the citation tracks the
         precise child excerpt.
    """

    def __init__(self, client: QdrantVectorClient, sparse: SparseEncoder) -> None:
        self._client = client
        self._sparse = sparse

    async def search(
        self,
        query: str,
        vector: list[float],
        *,
        limit: int,
        filters: SearchFilters | None,
    ) -> list[dict[str, Any]]:
        sparse_vec = await self._sparse.encode(query)
        children = await self._client.hybrid_search(
            vector,
            sparse_vec,
            limit=limit,
            query_filter=build_qdrant_filter(filters),
        )
        if not children:
            return []

        # Batch-fetch parents for full context
        parent_ids = list({
            c["payload"]["parent_id"]
            for c in children
            if c["payload"].get("parent_id")
        })
        parents = await self._client.fetch_parents_by_ids(parent_ids)

        expanded: list[dict[str, Any]] = []
        for child in children:
            payload = child["payload"]
            pid = payload.get("parent_id")
            parent_payload = parents.get(pid, {}) if pid else {}
            expanded.append({
                "id": child["id"],
                "score": child["score"],
                "payload": {
                    **payload,
                    # Replace content with parent (~1024 chars) for LLM context
                    "content": parent_payload.get("content") or payload.get("content", ""),
                    # Preserve child content for citation snippet display
                    "child_content": payload.get("content", ""),
                },
            })
        return expanded
