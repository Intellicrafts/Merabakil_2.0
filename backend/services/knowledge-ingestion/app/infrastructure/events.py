"""Kafka-backed event publisher for ingestion outcomes."""

from __future__ import annotations

import uuid

from legalos_common.messaging import (
    DocumentIngestedEvent,
    EventEnvelope,
    IngestionRequestedEvent,
    KafkaEventProducer,
    Topics,
)


class KafkaEventPublisher:
    def __init__(
        self, producer: KafkaEventProducer, *, collection: str, producer_name: str
    ) -> None:
        self._producer = producer
        self._collection = collection
        self._producer_name = producer_name

    async def document_ingested(
        self, *, document_id: str, chunk_count: int, doc_type: str, title: str | None
    ) -> None:
        payload = DocumentIngestedEvent(
            document_id=uuid.UUID(document_id),
            chunk_count=chunk_count,
            collection=self._collection,
            title=title,
            doc_type=doc_type,
        )
        envelope = EventEnvelope[DocumentIngestedEvent](
            event_type=Topics.DOCUMENT_INGESTED.value,
            producer=self._producer_name,
            payload=payload,
        )
        await self._producer.publish(Topics.DOCUMENT_INGESTED.value, envelope, key=document_id)

    async def ingestion_requested(
        self, *, payload: IngestionRequestedEvent, key: str | None = None
    ) -> None:
        envelope = EventEnvelope[IngestionRequestedEvent](
            event_type=Topics.INGESTION_REQUESTED.value,
            producer=self._producer_name,
            payload=payload,
        )
        await self._producer.publish(
            Topics.INGESTION_REQUESTED.value,
            envelope,
            key=key or str(payload.job_id or payload.document_id or payload.source_uri),
        )


class NullEventPublisher:
    """Used when Kafka is unavailable (e.g. tests / degraded mode)."""

    async def document_ingested(self, **_: object) -> None:
        return None

    async def ingestion_requested(self, **_: object) -> None:
        return None
