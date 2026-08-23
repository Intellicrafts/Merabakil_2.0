"""Qdrant-backed vector store for lawyer profiles."""

from __future__ import annotations

import logging
import uuid

from qdrant_client.http import models as qm

from app.infrastructure.lawyer_model import Lawyer
from legalos_common.clients.llm import build_embedding_client
from legalos_common.clients.qdrant import QdrantVectorClient, _point_id
from legalos_common.config import get_common_settings
from legalos_common.search.sparse_encoder import SparseEncoder

logger = logging.getLogger(__name__)

_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def _lawyer_point_id(lawyer_id: uuid.UUID) -> str:
    return _point_id(f"lawyer:{lawyer_id}")


def _build_embed_text(lawyer: Lawyer) -> str:
    parts = [lawyer.full_name]
    if lawyer.practice_areas:
        parts.append("specializes in " + ", ".join(lawyer.practice_areas))
    if lawyer.jurisdictions:
        parts.append("practices in " + ", ".join(lawyer.jurisdictions))
    if lawyer.city:
        parts.append(f"based in {lawyer.city}")
    if lawyer.bio:
        parts.append(lawyer.bio)
    if lawyer.summary:
        parts.append(lawyer.summary)
    return ". ".join(parts)


class LawyerVectorStore:
    """Manages the `lawyers` Qdrant collection — upsert, delete, hybrid search."""

    def __init__(self) -> None:
        settings = get_common_settings()
        self._url = settings.qdrant.qdrant_lawyers_url or settings.qdrant.qdrant_url
        qdrant_api_key = settings.qdrant.qdrant_lawyers_api_key or settings.qdrant.qdrant_api_key
        self._qdrant = QdrantVectorClient(
            self._url,
            settings.qdrant.qdrant_lawyers_collection,
            settings.llm.embedding_dim,
            api_key=qdrant_api_key,
        )
        self._embedder = build_embedding_client(settings.llm)
        self._sparse = SparseEncoder()
        self._ready = False

    @property
    def is_ready(self) -> bool:
        return self._ready

    async def startup(self) -> None:
        try:
            logger.info("lawyer_vector_store_connecting url=%s collection=%s", self._url, self._qdrant.collection)
            self._sparse.load()
            await self._qdrant.ensure_collection()
            self._ready = True
            logger.info("lawyer_vector_store_ready collection=%s", self._qdrant.collection)
        except Exception as exc:
            logger.warning("lawyer_vector_store_startup_failed error=%s — vector search disabled", exc)

    async def upsert(self, lawyer: Lawyer) -> None:
        if not self._ready:
            logger.debug("lawyer_vector_store_not_ready skipping upsert lawyer_id=%s", lawyer.id)
            return
        try:
            text = _build_embed_text(lawyer)
            dense = await self._embedder.embed_one(text)
            sparse = await self._sparse.encode(text)
            point = qm.PointStruct(
                id=_lawyer_point_id(lawyer.id),
                vector={"dense": dense, "sparse": sparse},
                payload={
                    "lawyer_id": str(lawyer.id),
                    "full_name": lawyer.full_name,
                    "practice_areas": list(lawyer.practice_areas or []),
                    "jurisdictions": list(lawyer.jurisdictions or []),
                    "city": lawyer.city or "",
                    "years_experience": lawyer.years_experience or 0,
                    "rating": float(lawyer.rating or 0),
                    "rating_count": lawyer.rating_count or 0,
                    "is_verified": bool(lawyer.is_verified),
                    "hourly_rate": float(lawyer.hourly_rate) if lawyer.hourly_rate else None,
                    "summary": lawyer.summary or "",
                },
            )
            await self._qdrant.upsert([point])
            logger.info("lawyer_indexed lawyer_id=%s", lawyer.id)
        except Exception as exc:
            logger.warning("lawyer_index_failed lawyer_id=%s error=%s", lawyer.id, exc)

    async def delete(self, lawyer_id: uuid.UUID) -> None:
        if not self._ready:
            return
        try:
            await self._qdrant._client.delete(
                collection_name=self._qdrant.collection,
                points_selector=qm.PointIdsList(points=[_lawyer_point_id(lawyer_id)]),
            )
        except Exception as exc:
            logger.warning("lawyer_delete_failed lawyer_id=%s error=%s", lawyer_id, exc)

    async def search(self, query: str, *, limit: int = 10) -> list[tuple[str, float]]:
        """Returns [(lawyer_id_str, score), ...] sorted by relevance."""
        if not self._ready:
            return []
        try:
            dense = await self._embedder.embed_one(query)
            sparse = await self._sparse.encode(query)
            hits = await self._qdrant.hybrid_search(
                dense, sparse, limit=limit
            )
            return [(h["payload"]["lawyer_id"], h["score"]) for h in hits if h.get("payload", {}).get("lawyer_id")]
        except Exception as exc:
            logger.warning("lawyer_search_failed error=%s", exc)
            return []


# Module-level singleton — created once at startup via main.py
_store: LawyerVectorStore | None = None


def get_lawyer_vector_store() -> LawyerVectorStore:
    global _store
    if _store is None:
        _store = LawyerVectorStore()
    return _store
