from __future__ import annotations

from app.application.use_cases import HybridSearchUseCase
from app.config import SearchSettings
from app.domain.rerank import LexicalReranker
from app.infrastructure.adapters import QdrantHybridAdapter
from app.infrastructure.cache import SearchResultCache
from legalos_common.clients import QdrantVectorClient, build_embedding_client
from legalos_common.clients.llm import EmbeddingClient
from legalos_common.search.sparse_encoder import SparseEncoder


class Container:
    def __init__(self, settings: SearchSettings) -> None:
        self.settings = settings
        self.embedder: EmbeddingClient = build_embedding_client(settings.llm)
        self.qdrant = QdrantVectorClient(
            settings.qdrant.qdrant_url,
            settings.qdrant.qdrant_collection,
            settings.llm.embedding_dim,
        )
        self.sparse = SparseEncoder()
        self.use_case = HybridSearchUseCase(
            embedder=self.embedder,
            hybrid_store=QdrantHybridAdapter(self.qdrant, self.sparse),
            reranker=LexicalReranker(),
            settings=settings,
        )
        self.cache = (
            SearchResultCache(settings.redis_url, ttl_seconds=settings.search_cache_ttl_seconds)
            if settings.search_cache_enabled
            else None
        )

    async def startup(self) -> None:
        self.sparse.load()
        await self.qdrant.ensure_collection()
        await self.qdrant.ensure_parents_collection()
        if self.cache:
            await self.cache.clear_all()

    async def shutdown(self) -> None:
        await self.qdrant.close()
        if self.cache:
            await self.cache.close()


_container: Container | None = None


def init_container(settings: SearchSettings) -> Container:
    global _container
    _container = Container(settings)
    return _container


def get_container() -> Container:
    if _container is None:
        raise RuntimeError("Container not initialised")
    return _container
