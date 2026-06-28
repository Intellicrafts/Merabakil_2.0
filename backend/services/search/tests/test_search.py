from __future__ import annotations

from typing import Any

import pytest

from app.application.use_cases import HybridSearchUseCase, SearchMode
from app.config import get_settings
from app.domain.fusion import reciprocal_rank_fusion
from app.domain.rerank import LexicalReranker
from legalos_common.clients.llm import StubEmbeddingClient


def _hit(doc_id: str, content: str, score: float = 1.0) -> dict[str, Any]:
    return {
        "id": doc_id,
        "score": score,
        "payload": {"chunk_id": doc_id, "document_id": doc_id, "content": content},
    }


def test_rrf_rewards_documents_in_multiple_lists() -> None:
    vector = [_hit("a", "x"), _hit("b", "y"), _hit("c", "z")]
    keyword = [_hit("b", "y"), _hit("d", "w"), _hit("a", "x")]
    fused = reciprocal_rank_fusion({"vector": vector, "keyword": keyword}, k=60)
    # 'a' and 'b' appear in both lists, so they should rank above 'c'/'d'.
    top_ids = [h.id for h in fused[:2]]
    assert set(top_ids) == {"a", "b"}
    assert fused[0].sources == {"vector", "keyword"}


def test_lexical_reranker_prioritises_query_overlap() -> None:
    from app.domain.fusion import ScoredHit

    hits = [
        ScoredHit(id="1", payload={"content": "tax law and GST compliance"}, score=0.5),
        ScoredHit(id="2", payload={"content": "criminal procedure and bail"}, score=0.5),
    ]
    reranked = LexicalReranker().rerank("GST compliance", hits, top_k=2)
    assert reranked[0].id == "1"


class FakeVectorStore:
    def __init__(self, hits: list[dict]) -> None:
        self._hits = hits

    async def search(self, vector, *, limit, filters):
        return self._hits[:limit]


class FakeKeywordStore:
    def __init__(self, hits: list[dict] | dict[str, list[dict]] | None = None) -> None:
        if isinstance(hits, dict):
            self._by_query = hits
            self._hits = []
        else:
            self._by_query = {}
            self._hits = hits or []

    async def search(self, query, *, size, filters):
        if query in self._by_query:
            return self._by_query[query][:size]
        return self._hits[:size]


@pytest.mark.asyncio
async def test_hybrid_search_returns_ranked_sources() -> None:
    settings = get_settings()
    vector_hits = [_hit("a", "arbitration agreement clause", 0.9), _hit("b", "unrelated", 0.4)]
    keyword_hits = [_hit("a", "arbitration agreement clause", 5.0), _hit("c", "noise", 1.0)]
    use_case = HybridSearchUseCase(
        embedder=StubEmbeddingClient(settings.llm.embedding_dim),
        vector_store=FakeVectorStore(vector_hits),
        keyword_store=FakeKeywordStore(keyword_hits),
        reranker=LexicalReranker(),
        settings=settings,
    )
    results = await use_case.search("arbitration agreement", top_k=3, mode=SearchMode.HYBRID)
    assert results
    assert results[0].document_id == "a"
    assert results[0].retrieval == "hybrid"


@pytest.mark.asyncio
async def test_article_query_uses_focused_keyword_search() -> None:
    settings = get_settings()
    article_chunk = _hit(
        "article-21",
        "21. Protection of life and personal liberty No person shall be deprived of his life",
        2.0,
    )
    noisy_chunk = _hit("noise", "grants in aid to states for development schemes", 1.0)
    use_case = HybridSearchUseCase(
        embedder=StubEmbeddingClient(settings.llm.embedding_dim),
        vector_store=FakeVectorStore([noisy_chunk]),
        keyword_store=FakeKeywordStore(
            {
                "What is Article 21 of the Constitution of India?": [noisy_chunk],
                "Article 21": [article_chunk],
            }
        ),
        reranker=LexicalReranker(),
        settings=settings,
    )
    results = await use_case.search(
        "What is Article 21 of the Constitution of India?",
        top_k=1,
        mode=SearchMode.HYBRID,
    )
    assert results[0].document_id == "article-21"


@pytest.mark.asyncio
async def test_vector_only_mode_skips_keyword() -> None:
    settings = get_settings()
    use_case = HybridSearchUseCase(
        embedder=StubEmbeddingClient(settings.llm.embedding_dim),
        vector_store=FakeVectorStore([_hit("a", "contract", 0.9)]),
        keyword_store=FakeKeywordStore([]),
        reranker=LexicalReranker(),
        settings=settings,
    )
    results = await use_case.search("contract", mode=SearchMode.VECTOR)
    assert len(results) == 1
    assert results[0].retrieval == "vector"
