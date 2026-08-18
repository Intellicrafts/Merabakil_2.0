"""Hybrid search use case: Qdrant-native dense + sparse with server-side RRF fusion."""

from __future__ import annotations

from enum import StrEnum

from app.application.ports import HybridSearchPort
from app.config import SearchSettings
from app.domain.fusion import ScoredHit
from app.domain.rerank import Reranker
from legalos_common.clients.llm import EmbeddingClient
from legalos_common.logging import get_logger
from legalos_common.rag.filters import SearchFilters
from legalos_common.rag.schemas import RetrievedSource

logger = get_logger(__name__)


class SearchMode(StrEnum):
    VECTOR = "vector"
    KEYWORD = "keyword"
    HYBRID = "hybrid"


class HybridSearchUseCase:
    def __init__(
        self,
        *,
        embedder: EmbeddingClient,
        hybrid_store: HybridSearchPort,
        reranker: Reranker,
        settings: SearchSettings,
    ) -> None:
        self._embedder = embedder
        self._hybrid = hybrid_store
        self._reranker = reranker
        self._settings = settings

    async def search(
        self,
        query: str,
        *,
        top_k: int | None = None,
        mode: SearchMode = SearchMode.HYBRID,
        filters: SearchFilters | None = None,
    ) -> list[RetrievedSource]:
        top_k = top_k or self._settings.default_top_k
        multiplier = (
            2
            if filters and (filters.document_id or filters.document_ids)
            else self._settings.candidate_multiplier
        )
        candidates = top_k * multiplier

        vector = await self._embedder.embed_one(query)
        raw = await self._hybrid.search(query, vector, limit=candidates, filters=filters)

        fused = [
            ScoredHit(
                id=h["id"],
                payload=h.get("payload", {}),
                score=float(h.get("score", 0.0)),
                sources={"hybrid"},
            )
            for h in raw
        ]

        reranked = self._reranker.rerank(query, fused, top_k=top_k)
        logger.info(
            "search_completed", mode=mode.value, results=len(reranked), query_len=len(query)
        )
        return [self._to_source(h) for h in reranked]

    @staticmethod
    def _to_source(hit: ScoredHit) -> RetrievedSource:
        p = hit.payload
        return RetrievedSource(
            chunk_id=p.get("chunk_id", hit.id),
            document_id=p.get("document_id", ""),
            title=p.get("title"),
            doc_type=p.get("doc_type"),
            jurisdiction=p.get("jurisdiction"),
            citation=p.get("citation") or None,
            section=p.get("section") or None,
            content=p.get("content", ""),
            score=hit.score,
            retrieval="hybrid" if len(hit.sources) > 1 else next(iter(hit.sources), "hybrid"),
        )
