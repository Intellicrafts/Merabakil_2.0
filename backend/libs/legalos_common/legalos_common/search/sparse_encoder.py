"""FastEmbed BM25 sparse encoder — runs in a thread pool to avoid blocking the event loop."""

from __future__ import annotations

import asyncio
import logging

logger = logging.getLogger(__name__)


class SparseEncoder:
    """BM25 sparse encoder backed by FastEmbed's Qdrant/bm25 model.

    Call `.load()` once at startup (downloads model on first run, then cached).
    If the model fails to load, encode() returns empty SparseVector objects so
    hybrid search degrades gracefully to dense-only RRF.
    """

    def __init__(self, model_name: str = "Qdrant/bm25") -> None:
        self._model_name = model_name
        self._model = None

    def load(self) -> None:
        try:
            from fastembed import SparseTextEmbedding

            self._model = SparseTextEmbedding(model_name=self._model_name)
            logger.info("sparse_encoder_loaded model=%s", self._model_name)
        except Exception as exc:
            logger.warning("sparse_encoder_load_failed error=%s — sparse search disabled", exc)

    def _encode_sync(self, texts: list[str]):
        from qdrant_client.models import SparseVector

        if self._model is None:
            return [SparseVector(indices=[], values=[]) for _ in texts]
        results = list(self._model.embed(texts))
        return [
            SparseVector(indices=r.indices.tolist(), values=r.values.tolist())
            for r in results
        ]

    async def encode_many(self, texts: list[str]):
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._encode_sync, texts)

    async def encode(self, text: str):
        results = await self.encode_many([text])
        return results[0]
