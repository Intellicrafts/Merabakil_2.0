"""Tests for native embedding cache incremental warm."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path[:0] = [str(ROOT / "data-platform"), str(ROOT / "backend" / "scripts")]


class StubEmbedder:
    def __init__(self) -> None:
        self.calls = 0

    async def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls += 1
        return [[float(len(t)), 0.0, 1.0] for t in texts]


def test_warm_embeds_only_missing(tmp_path, monkeypatch) -> None:
    import embedding.corpus_cache as cache

    monkeypatch.setattr(cache, "CACHE_DIR", tmp_path)
    monkeypatch.setattr(cache, "VECTORS_PATH", tmp_path / "vectors.pkl")
    monkeypatch.setattr(cache, "CHUNK_INDEX_PATH", tmp_path / "chunks.json")

    corpus = [
        {
            "id": "a:0",
            "content": "hello world",
            "content_hash": "h1",
            "source_uri": "src/a.json",
        },
        {
            "id": "a:1",
            "content": "second chunk",
            "content_hash": "h2",
            "source_uri": "src/a.json",
        },
    ]
    embedder = StubEmbedder()

    async def run() -> None:
        v1, emb1, cached1 = await cache.warm_corpus_vectors(corpus, embedder)
        assert emb1 == 2
        assert cached1 == 0
        assert set(v1) == {"a:0", "a:1"}
        assert embedder.calls == 1

        v2, emb2, cached2 = await cache.warm_corpus_vectors(corpus, embedder)
        assert emb2 == 0
        assert cached2 == 2
        assert set(v2) == {"a:0", "a:1"}

        # Force one source
        _, emb3, _ = await cache.warm_corpus_vectors(
            corpus, embedder, force_sources={"src/a.json"}
        )
        assert emb3 == 2

    asyncio.run(run())
