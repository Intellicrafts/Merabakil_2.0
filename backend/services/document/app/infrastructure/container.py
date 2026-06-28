"""Shared, long-lived client container with lifecycle management."""

from __future__ import annotations

from app.config import DocumentSettings
from app.infrastructure.events import (
    HttpIngestionClient,
    IngestionTrigger,
    KafkaEventPublisher,
    NullEventPublisher,
)
from legalos_common.clients import S3Storage
from legalos_common.logging import get_logger
from legalos_common.messaging import KafkaEventProducer

logger = get_logger(__name__)


class Container:
    def __init__(self, settings: DocumentSettings) -> None:
        self.settings = settings
        self.s3 = S3Storage(settings.s3)
        self._producer = KafkaEventProducer(settings.kafka_bootstrap_servers)
        self.events: KafkaEventPublisher | NullEventPublisher = NullEventPublisher()
        self.http_ingestion = HttpIngestionClient(settings.ingestion_service_url)
        self.ingestion: IngestionTrigger | None = None

    async def startup(self) -> None:
        await self.s3.ensure_bucket()
        kafka: KafkaEventPublisher | NullEventPublisher = NullEventPublisher()
        try:
            await self._producer.start()
            kafka = KafkaEventPublisher(
                self._producer,
                producer_name=self.settings.service_name,
            )
        except Exception:
            logger.warning("kafka_unavailable_using_null_publisher")
        self.events = kafka
        self.ingestion = IngestionTrigger(
            kafka=kafka,
            http=self.http_ingestion,
            prefer_kafka=self.settings.use_kafka_ingestion,
        )

    async def shutdown(self) -> None:
        await self.http_ingestion.close()
        await self._producer.stop()


_container: Container | None = None


def init_container(settings: DocumentSettings) -> Container:
    global _container
    _container = Container(settings)
    return _container


def get_container() -> Container:
    if _container is None:
        raise RuntimeError("Container not initialised")
    return _container
