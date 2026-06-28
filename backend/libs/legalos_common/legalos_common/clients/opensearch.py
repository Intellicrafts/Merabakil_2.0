"""OpenSearch keyword/BM25 client wrapper."""

from __future__ import annotations

from typing import Any

from opensearchpy import AsyncOpenSearch

from legalos_common.logging import get_logger
from legalos_common.rag.filters import SearchFilters
from legalos_common.search.filter_builder import build_opensearch_clauses

logger = get_logger(__name__)

_INDEX_MAPPING: dict[str, Any] = {
    "mappings": {
        "properties": {
            "document_id": {"type": "keyword"},
            "chunk_id": {"type": "keyword"},
            "title": {"type": "text"},
            "content": {"type": "text", "analyzer": "english"},
            "doc_type": {"type": "keyword"},
            "jurisdiction": {"type": "keyword"},
            "citation": {"type": "keyword"},
            "section": {"type": "keyword"},
        }
    }
}


class OpenSearchClient:
    def __init__(self, url: str, index: str) -> None:
        self._client = AsyncOpenSearch(hosts=[url])
        self._index = index

    @property
    def index(self) -> str:
        return self._index

    async def ensure_index(self) -> None:
        if not await self._client.indices.exists(index=self._index):
            await self._client.indices.create(index=self._index, body=_INDEX_MAPPING)
            logger.info("opensearch_index_created", index=self._index)

    async def index_document(self, doc_id: str, body: dict[str, Any]) -> None:
        await self._client.index(index=self._index, id=doc_id, body=body, refresh=True)

    async def bulk_index(self, docs: list[dict[str, Any]]) -> None:
        actions: list[dict[str, Any]] = []
        for doc in docs:
            actions.append({"index": {"_index": self._index, "_id": doc["chunk_id"]}})
            actions.append(doc)
        if actions:
            await self._client.bulk(body=actions, refresh=True)

    async def search(
        self,
        query: str,
        *,
        size: int = 10,
        filters: SearchFilters | dict[str, str] | None = None,
    ) -> list[dict[str, Any]]:
        must: list[dict[str, Any]] = [
            {"multi_match": {"query": query, "fields": ["title^2", "content"]}}
        ]
        if isinstance(filters, SearchFilters):
            must += build_opensearch_clauses(filters)
        elif filters:
            must += [{"term": {k: v}} for k, v in filters.items()]
        body = {"size": size, "query": {"bool": {"must": must}}}
        resp = await self._client.search(index=self._index, body=body)
        hits = resp.get("hits", {}).get("hits", [])
        return [
            {"id": h["_id"], "score": h["_score"], "payload": h["_source"]}
            for h in hits
        ]

    async def close(self) -> None:
        await self._client.close()
