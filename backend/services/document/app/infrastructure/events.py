"""Kafka-backed ingestion trigger and HTTP fallback to knowledge-ingestion."""

from __future__ import annotations

import httpx

from legalos_common.logging import get_logger
from legalos_common.messaging import (
    EventEnvelope,
    IngestionRequestedEvent,
    KafkaEventProducer,
    Topics,
)

logger = get_logger(__name__)


class KafkaEventPublisher:
    def __init__(self, producer: KafkaEventProducer, *, producer_name: str) -> None:
        self._producer = producer
        self._producer_name = producer_name

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
            key=key or str(payload.document_id or payload.source_uri),
        )


class HttpIngestionClient:
    """Fallback: POST to knowledge-ingestion async upload endpoint."""

    def __init__(self, base_url: str, *, timeout: float = 60.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def request_ingestion(
        self,
        *,
        payload: IngestionRequestedEvent,
        user_token: str,
    ) -> None:
        url = f"{self._base_url}/api/v1/knowledge/documents"
        body = {
            "title": payload.title or "Uploaded document",
            "doc_type": payload.doc_type,
            "text": f"[ingestion from document service: {payload.document_id}]",
            "jurisdiction": payload.jurisdiction,
        }
        headers = {"Authorization": f"Bearer {user_token}"}
        resp = await self._get_client().post(url, json=body, headers=headers)
        resp.raise_for_status()


class NullEventPublisher:
    async def ingestion_requested(self, **_: object) -> None:
        return None


class IngestionTrigger:
    """Publishes ingestion via Kafka when available, otherwise HTTP fallback."""

    def __init__(
        self,
        *,
        kafka: KafkaEventPublisher | NullEventPublisher,
        http: HttpIngestionClient | None,
        prefer_kafka: bool,
    ) -> None:
        self._kafka = kafka
        self._http = http
        self._prefer_kafka = prefer_kafka

    async def trigger(
        self,
        *,
        payload: IngestionRequestedEvent,
        user_token: str,
    ) -> None:
        if self._prefer_kafka and not isinstance(self._kafka, NullEventPublisher):
            try:
                await self._kafka.ingestion_requested(payload=payload)
                return
            except Exception:
                logger.warning("kafka_ingestion_trigger_failed_falling_back_to_http")

        if self._http is not None:
            await self._http.request_ingestion(payload=payload, user_token=user_token)
            return

        await self._kafka.ingestion_requested(payload=payload)
