"""Hybrid search use case: vector + keyword retrieval, RRF fusion, re-ranking."""

from __future__ import annotations

import re
from enum import StrEnum

from app.application.ports import KeywordSearchPort, VectorSearchPort
from app.config import SearchSettings
from app.domain.fusion import ScoredHit, reciprocal_rank_fusion
from app.domain.rerank import Reranker
from legalos_common.clients.llm import EmbeddingClient
from legalos_common.logging import get_logger
from legalos_common.rag.filters import SearchFilters
from legalos_common.rag.schemas import RetrievedSource

logger = get_logger(__name__)

_ARTICLE_RE = re.compile(r"\barticle\s+(\d+[a-z]?)\b", re.IGNORECASE)


def _focused_article_queries(query: str) -> list[str]:
    """Long natural-language questions dilute BM25; focused article queries retrieve better."""
    focused: list[str] = []
    seen: set[str] = set()
    for article in _ARTICLE_RE.findall(query):
        phrase = f"Article {article}"
        key = phrase.lower()
        if key not in seen:
            focused.append(phrase)
            seen.add(key)
    return focused


class SearchMode(StrEnum):
    VECTOR = "vector"
    KEYWORD = "keyword"
    HYBRID = "hybrid"


class HybridSearchUseCase:
    def __init__(
        self,
        *,
        embedder: EmbeddingClient,
        vector_store: VectorSearchPort,
        keyword_store: KeywordSearchPort,
        reranker: Reranker,
        settings: SearchSettings,
    ) -> None:
        self._embedder = embedder
        self._vector = vector_store
        self._keyword = keyword_store
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

        result_lists: dict[str, list[dict]] = {}

        if mode in (SearchMode.VECTOR, SearchMode.HYBRID):
            vector = await self._embedder.embed_one(query)
            result_lists["vector"] = await self._vector.search(
                vector, limit=candidates, filters=filters
            )

        if mode in (SearchMode.KEYWORD, SearchMode.HYBRID):
            result_lists["keyword"] = await self._keyword.search(
                query, size=candidates, filters=filters
            )
            for article_query in _focused_article_queries(query):
                result_lists[f"keyword:{article_query.lower()}"] = await self._keyword.search(
                    article_query, size=candidates, filters=filters
                )

        if mode is SearchMode.HYBRID:
            fused = reciprocal_rank_fusion(result_lists, k=self._settings.rrf_k)
        else:
            method = mode.value
            fused = [
                ScoredHit(
                    id=h["id"],
                    payload=h.get("payload", {}),
                    score=float(h.get("score", 0.0)),
                    sources={method},
                )
                for h in result_lists.get(method, [])
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
