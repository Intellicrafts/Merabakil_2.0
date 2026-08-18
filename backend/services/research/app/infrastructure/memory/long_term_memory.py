"""Long-term user facts stored in Qdrant with semantic deduplication."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime

from qdrant_client import AsyncQdrantClient
from qdrant_client.http import models as qm

logger = logging.getLogger(__name__)


class LongTermMemory:
    def __init__(
        self,
        client: AsyncQdrantClient,
        embedder,
        collection: str,
        *,
        dedup_threshold: float = 0.92,
    ) -> None:
        self._client = client
        self._embedder = embedder
        self._col = collection
        self._dedup = dedup_threshold

    async def ensure_collection(self, dim: int) -> None:
        try:
            existing = await self._client.get_collections()
            names = {c.name for c in existing.collections}
            if self._col not in names:
                await self._client.create_collection(
                    collection_name=self._col,
                    vectors_config=qm.VectorParams(size=dim, distance=qm.Distance.COSINE),
                )
                logger.info("ltm_collection_created collection=%s", self._col)
        except Exception as exc:
            logger.warning("ltm_ensure_collection_failed error=%s", exc)

    async def store_fact(self, user_id: str, fact: str, session_id: str) -> None:
        try:
            embedding = await self._embedder.embed_one(fact)
        except Exception as exc:
            logger.warning("ltm_embed_failed error=%s", exc)
            return

        existing = await self._find_similar(user_id, embedding, top_k=1)
        if existing and existing[0]["score"] >= self._dedup:
            # Near-duplicate — bump access count
            fact_id = existing[0]["fact_id"]
            new_count = existing[0]["access_count"] + 1
            try:
                await self._client.set_payload(
                    collection_name=self._col,
                    payload={"last_accessed": datetime.utcnow().isoformat(), "access_count": new_count},
                    points=[fact_id],
                )
            except Exception as exc:
                logger.warning("ltm_update_failed error=%s", exc)
            return

        fact_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        try:
            await self._client.upsert(
                collection_name=self._col,
                points=[
                    qm.PointStruct(
                        id=fact_id,
                        vector=embedding,
                        payload={
                            "fact_id": fact_id,
                            "user_id": user_id,
                            "content": fact,
                            "source_session_id": session_id,
                            "created_at": now,
                            "last_accessed": now,
                            "access_count": 1,
                        },
                    )
                ],
                wait=True,
            )
        except Exception as exc:
            logger.warning("ltm_store_failed error=%s", exc)

    async def retrieve_relevant(self, user_id: str, query: str, top_k: int = 3) -> list[str]:
        if not user_id:
            return []
        try:
            embedding = await self._embedder.embed_one(query)
            hits = await self._find_similar(user_id, embedding, top_k=top_k)
            return [h["content"] for h in hits]
        except Exception as exc:
            logger.warning("ltm_retrieve_failed user=%s error=%s", user_id, exc)
            return []

    async def _find_similar(self, user_id: str, embedding: list[float], top_k: int) -> list[dict]:
        try:
            user_filter = qm.Filter(
                must=[qm.FieldCondition(key="user_id", match=qm.MatchValue(value=user_id))]
            )
            response = await self._client.query_points(
                collection_name=self._col,
                query=embedding,
                query_filter=user_filter,
                limit=top_k,
                with_payload=True,
                with_vectors=False,
            )
            return [
                {
                    "fact_id": r.payload.get("fact_id", str(r.id)),
                    "content": r.payload.get("content", ""),
                    "score": r.score,
                    "access_count": r.payload.get("access_count", 1),
                }
                for r in response.points
            ]
        except Exception as exc:
            logger.warning("ltm_search_failed error=%s", exc)
            return []
