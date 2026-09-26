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


class FakeHybridStore:
    """Fake HybridSearchPort for testing — returns pre-configured hits."""

    def __init__(self, hits: list[dict]) -> None:
        self._hits = hits

    async def search(self, query: str, vector: list[float], *, limit: int, filters: Any, **access: Any) -> list[dict]:
        self.access = access
        return self._hits[:limit]


@pytest.mark.asyncio
async def test_hybrid_search_returns_ranked_sources() -> None:
    settings = get_settings()
    hits = [
        _hit("a", "arbitration agreement clause", 0.9),
        _hit("b", "unrelated content", 0.4),
        _hit("c", "noise document", 0.2),
    ]
    use_case = HybridSearchUseCase(
        embedder=StubEmbeddingClient(settings.llm.embedding_dim),
        hybrid_store=FakeHybridStore(hits),
        reranker=LexicalReranker(),
        settings=settings,
    )
    results = await use_case.search("arbitration agreement", top_k=3, mode=SearchMode.HYBRID)
    assert results
    assert results[0].document_id == "a"
    assert results[0].retrieval == "hybrid"


@pytest.mark.asyncio
async def test_hybrid_search_applies_reranker() -> None:
    settings = get_settings()
    hits = [
        _hit("bail-law", "criminal procedure and bail provisions", 0.5),
        _hit("gst-law", "tax law and GST compliance", 0.5),
    ]
    use_case = HybridSearchUseCase(
        embedder=StubEmbeddingClient(settings.llm.embedding_dim),
        hybrid_store=FakeHybridStore(hits),
        reranker=LexicalReranker(),
        settings=settings,
    )
    results = await use_case.search("GST compliance", top_k=2, mode=SearchMode.HYBRID)
    assert results[0].document_id == "gst-law"


@pytest.mark.asyncio
async def test_hybrid_search_respects_top_k() -> None:
    settings = get_settings()
    hits = [_hit(f"doc-{i}", f"document content {i}", float(10 - i)) for i in range(10)]
    use_case = HybridSearchUseCase(
        embedder=StubEmbeddingClient(settings.llm.embedding_dim),
        hybrid_store=FakeHybridStore(hits),
        reranker=LexicalReranker(),
        settings=settings,
    )
    results = await use_case.search("document content", top_k=3)
    assert len(results) <= 3


# ── Access control + relevance ───────────────────────────────────────────────


def test_access_filter_returns_public_corpus_only() -> None:
    from legalos_common.search.filter_builder import build_qdrant_filter

    text = str(build_qdrant_filter(None, enforce_access=True).model_dump())
    assert "'public'" in text and "owner_id" not in text


@pytest.mark.asyncio
async def test_use_case_enforces_visibility() -> None:
    settings = get_settings()
    store = FakeHybridStore([_hit("a", "text")])
    use_case = HybridSearchUseCase(
        embedder=StubEmbeddingClient(settings.llm.embedding_dim),
        hybrid_store=store,
        reranker=LexicalReranker(),
        settings=settings,
    )
    await use_case.search("text", top_k=1)
    assert store.access["enforce_access"] is True


@pytest.mark.asyncio
async def test_adapter_drops_weak_matches_and_reports_cosine() -> None:
    from app.infrastructure.adapters import QdrantHybridAdapter

    class FakeClient:
        async def hybrid_search(self, *a, **k):
            return [_hit("strong", "bail under BNSS"), _hit("weak", "unrelated")]

        async def dense_scores(self, vector, ids):
            return {"strong": 0.82, "weak": 0.31}

        async def fetch_parents_by_ids(self, ids):
            return {}

    class FakeSparse:
        async def encode(self, q):
            return None

    adapter = QdrantHybridAdapter(FakeClient(), FakeSparse())
    hits = await adapter.search("bail", [0.0], limit=5, filters=None, min_dense_score=0.5)
    assert [h["id"] for h in hits] == ["strong"]
    assert hits[0]["payload"]["_dense_score"] == 0.82
