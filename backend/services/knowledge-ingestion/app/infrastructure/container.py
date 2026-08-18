"""Shared, long-lived client container with lifecycle management."""

from __future__ import annotations

from app.config import IngestionSettings
from app.infrastructure.events import KafkaEventPublisher, NullEventPublisher
from app.infrastructure.indexer import MultiStoreIndexer
from legalos_common.clients import (
    Neo4jClient,
    QdrantVectorClient,
    S3Storage,
    build_embedding_client,
)
from legalos_common.clients.llm import EmbeddingClient
from legalos_common.logging import get_logger
from legalos_common.messaging import KafkaEventProducer
from legalos_common.search.sparse_encoder import SparseEncoder
from app.infrastructure.job_store import IngestionJobStore

logger = get_logger(__name__)


class Container:
    def __init__(self, settings: IngestionSettings) -> None:
        self.settings = settings
        self.embedder: EmbeddingClient = build_embedding_client(settings.llm)
        self.qdrant = QdrantVectorClient(
            settings.qdrant.qdrant_url,
            settings.qdrant.qdrant_collection,
            settings.llm.embedding_dim,
        )
        self.neo4j = Neo4jClient(
            settings.neo4j.neo4j_uri, settings.neo4j.neo4j_user, settings.neo4j.neo4j_password
        )
        self.s3 = S3Storage(settings.s3)
        self.sparse = SparseEncoder()
        self.indexer = MultiStoreIndexer(
            qdrant=self.qdrant, sparse=self.sparse, neo4j=self.neo4j
        )
        self._producer = KafkaEventProducer(settings.kafka_bootstrap_servers)
        self.events: KafkaEventPublisher | NullEventPublisher = NullEventPublisher()
        self.jobs = IngestionJobStore(settings.redis_url)

    async def startup(self) -> None:
        self.sparse.load()
        await self.qdrant.ensure_collection()
        await self.qdrant.ensure_parents_collection()
        await self.s3.ensure_bucket()
        try:
            await self._producer.start()
            self.events = KafkaEventPublisher(
                self._producer,
                collection=self.settings.qdrant.qdrant_collection,
                producer_name=self.settings.service_name,
            )
        except Exception:
            logger.warning("kafka_unavailable_using_null_publisher")
            self.events = NullEventPublisher()

    async def shutdown(self) -> None:
        await self.qdrant.close()
        await self.neo4j.close()
        await self._producer.stop()
        await self.jobs.close()


_container: Container | None = None


def init_container(settings: IngestionSettings) -> Container:
    global _container
    _container = Container(settings)
    return _container


def get_container() -> Container:
    if _container is None:
        raise RuntimeError("Container not initialised")
    return _container
