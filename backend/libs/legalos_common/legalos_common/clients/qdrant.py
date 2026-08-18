"""Qdrant vector store client — named dense+sparse vectors, hybrid search, parent-child."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qm
from qdrant_client.models import Fusion, FusionQuery, Prefetch, SparseVector

from legalos_common.logging import get_logger

if TYPE_CHECKING:
    pass

logger = get_logger(__name__)

_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # UUID namespace for deterministic IDs


def _point_id(key: str) -> str:
    return str(uuid.uuid5(_NS, key))


class QdrantVectorClient:
    def __init__(self, url: str, collection: str, dim: int) -> None:
        self._client = AsyncQdrantClient(url=url)
        self._collection = collection
        self._dim = dim

    @property
    def collection(self) -> str:
        return self._collection

    @property
    def parents_collection(self) -> str:
        return f"{self._collection}_parents"

    # ------------------------------------------------------------------
    # Collection lifecycle
    # ------------------------------------------------------------------

    async def ensure_collection(self) -> None:
        """Create the children collection with named dense + sparse vectors."""
        existing = await self._client.get_collections()
        names = {c.name for c in existing.collections}
        if self._collection not in names:
            await self._client.create_collection(
                collection_name=self._collection,
                vectors_config={
                    "dense": qm.VectorParams(size=self._dim, distance=qm.Distance.COSINE),
                },
                sparse_vectors_config={
                    "sparse": qm.SparseVectorParams(
                        index=qm.SparseIndexParams(on_disk=False),
                    ),
                },
            )
            logger.info("qdrant_collection_created", collection=self._collection)

    async def ensure_parents_collection(self) -> None:
        """Create the parents collection with a dummy 1-dim DOT vector.

        Parents are never searched — they're fetched by ID after child retrieval
        to provide full context to the LLM.
        """
        existing = await self._client.get_collections()
        names = {c.name for c in existing.collections}
        if self.parents_collection not in names:
            await self._client.create_collection(
                collection_name=self.parents_collection,
                vectors_config={
                    "dense": qm.VectorParams(size=1, distance=qm.Distance.DOT),
                },
            )
            logger.info("qdrant_parents_collection_created", collection=self.parents_collection)

    # ------------------------------------------------------------------
    # Upsert
    # ------------------------------------------------------------------

    async def upsert(self, points: list[qm.PointStruct]) -> None:
        """Upsert into the children (main) collection."""
        await self._client.upsert(collection_name=self._collection, points=points)

    async def upsert_parents(self, points: list[qm.PointStruct]) -> None:
        """Upsert into the parents collection."""
        await self._client.upsert(collection_name=self.parents_collection, points=points)

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    async def delete_by_document_id(self, document_id: str) -> None:
        """Delete children by document_id."""
        await self._client.delete(
            collection_name=self._collection,
            points_selector=qm.FilterSelector(
                filter=qm.Filter(
                    must=[qm.FieldCondition(key="document_id", match=qm.MatchValue(value=document_id))]
                )
            ),
        )

    async def delete_parents_by_document_id(self, document_id: str) -> None:
        """Delete parents by document_id."""
        await self._client.delete(
            collection_name=self.parents_collection,
            points_selector=qm.FilterSelector(
                filter=qm.Filter(
                    must=[qm.FieldCondition(key="document_id", match=qm.MatchValue(value=document_id))]
                )
            ),
        )

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    async def search(
        self,
        vector: list[float],
        *,
        limit: int = 10,
        query_filter: qm.Filter | None = None,
    ) -> list[dict[str, Any]]:
        """Dense-only search using the 'dense' named vector."""
        response = await self._client.query_points(
            collection_name=self._collection,
            query=vector,
            using="dense",
            query_filter=query_filter,
            limit=limit,
            with_payload=True,
        )
        return [
            {"id": str(r.id), "score": r.score, "payload": r.payload or {}}
            for r in response.points
        ]

    async def hybrid_search(
        self,
        dense_vector: list[float],
        sparse_vector: SparseVector,
        *,
        limit: int = 10,
        prefetch_limit: int | None = None,
        query_filter: qm.Filter | None = None,
    ) -> list[dict[str, Any]]:
        """Hybrid dense + sparse search with server-side RRF fusion (children collection)."""
        prefetch_k = prefetch_limit or limit * 3
        response = await self._client.query_points(
            collection_name=self._collection,
            prefetch=[
                Prefetch(query=dense_vector, using="dense", limit=prefetch_k, filter=query_filter),
                Prefetch(query=sparse_vector, using="sparse", limit=prefetch_k, filter=query_filter),
            ],
            query=FusionQuery(fusion=Fusion.RRF),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
        return [
            {"id": str(r.id), "score": r.score, "payload": r.payload or {}}
            for r in response.points
        ]

    async def fetch_parents_by_ids(self, parent_ids: list[str]) -> dict[str, dict[str, Any]]:
        """Batch-fetch parent payloads by their parent_id strings."""
        if not parent_ids:
            return {}
        point_ids = [_point_id(pid) for pid in parent_ids]
        response = await self._client.retrieve(
            collection_name=self.parents_collection,
            ids=point_ids,
            with_payload=True,
        )
        return {
            p.payload["parent_id"]: p.payload
            for p in response
            if p.payload and "parent_id" in p.payload
        }

    async def close(self) -> None:
        await self._client.close()
