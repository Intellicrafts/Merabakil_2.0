"""Qdrant vector store client wrapper."""

from __future__ import annotations

from typing import Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qm

from legalos_common.logging import get_logger

logger = get_logger(__name__)


class QdrantVectorClient:
    def __init__(self, url: str, collection: str, dim: int) -> None:
        self._client = AsyncQdrantClient(url=url)
        self._collection = collection
        self._dim = dim

    @property
    def collection(self) -> str:
        return self._collection

    async def ensure_collection(self) -> None:
        existing = await self._client.get_collections()
        names = {c.name for c in existing.collections}
        if self._collection not in names:
            await self._client.create_collection(
                collection_name=self._collection,
                vectors_config=qm.VectorParams(size=self._dim, distance=qm.Distance.COSINE),
            )
            logger.info("qdrant_collection_created", collection=self._collection)

    async def upsert(self, points: list[qm.PointStruct]) -> None:
        await self._client.upsert(collection_name=self._collection, points=points)

    async def search(
        self,
        vector: list[float],
        *,
        limit: int = 10,
        query_filter: qm.Filter | None = None,
    ) -> list[dict[str, Any]]:
        if hasattr(self._client, "search"):
            results = await self._client.search(
                collection_name=self._collection,
                query_vector=vector,
                limit=limit,
                query_filter=query_filter,
                with_payload=True,
            )
        else:
            response = await self._client.query_points(
                collection_name=self._collection,
                query=vector,
                query_filter=query_filter,
                limit=limit,
                with_payload=True,
            )
            results = response.points
        return [
            {"id": str(r.id), "score": r.score, "payload": r.payload or {}}
            for r in results
        ]

    async def close(self) -> None:
        await self._client.close()
