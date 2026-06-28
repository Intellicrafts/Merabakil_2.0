from __future__ import annotations

from app.application.use_cases import HybridSearchUseCase
from app.config import SearchSettings
from app.domain.rerank import LexicalReranker
from app.infrastructure.adapters import OpenSearchAdapter, QdrantSearchAdapter
from app.infrastructure.cache import SearchResultCache
from legalos_common.clients import OpenSearchClient, QdrantVectorClient, build_embedding_client
from legalos_common.clients.llm import EmbeddingClient


class Container:
    def __init__(self, settings: SearchSettings) -> None:
        self.settings = settings
        self.embedder: EmbeddingClient = build_embedding_client(settings.llm)
        self.qdrant = QdrantVectorClient(
            settings.qdrant.qdrant_url,
            settings.qdrant.qdrant_collection,
            settings.llm.embedding_dim,
        )
        self.opensearch = OpenSearchClient(
            settings.opensearch.opensearch_url, settings.opensearch.opensearch_index
        )
        self.use_case = HybridSearchUseCase(
            embedder=self.embedder,
            vector_store=QdrantSearchAdapter(self.qdrant),
            keyword_store=OpenSearchAdapter(self.opensearch),
            reranker=LexicalReranker(),
            settings=settings,
        )
        self.cache = (
            SearchResultCache(settings.redis_url, ttl_seconds=settings.search_cache_ttl_seconds)
            if settings.search_cache_enabled
            else None
        )

    async def startup(self) -> None:
        await self.qdrant.ensure_collection()
        await self.opensearch.ensure_index()
        if self.cache:
            await self.cache.clear_all()

    async def shutdown(self) -> None:
        await self.qdrant.close()
        await self.opensearch.close()
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
