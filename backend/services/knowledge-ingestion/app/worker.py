"""Kafka worker: asynchronously ingest documents on ``ingestion.requested`` events."""

from __future__ import annotations

import asyncio
import json
import uuid

from app.config import get_settings
from app.infrastructure.container import init_container
from app.infrastructure.db import session_manager
from app.infrastructure.job_store import JobStatus
from app.infrastructure.repositories import DocumentRepository
from legalos_common.logging import configure_logging, get_logger
from legalos_common.messaging import KafkaEventConsumer, Topics

logger = get_logger("knowledge.worker")


async def _handle(raw: bytes, container) -> None:
    envelope = json.loads(raw)
    payload = envelope.get("payload", {})
    job_id = payload.get("job_id")
    storage_key = payload.get("storage_key") or payload.get("source_uri")
    if not storage_key:
        logger.warning("ingestion_event_missing_source", payload=payload)
        if job_id:
            await container.jobs.update(job_id, status=JobStatus.FAILED, error="missing source")
        return

    if job_id:
        await container.jobs.update(job_id, status=JobStatus.PROCESSING)

    key = storage_key.split(f"{container.s3.bucket}/", 1)[-1]
    if key.startswith("s3://"):
        key = key.split("/", 3)[-1]

    try:
        data = await container.s3.get_object(key)
    except Exception as exc:
        if job_id:
            await container.jobs.update(job_id, status=JobStatus.FAILED, error=str(exc))
        raise

    from app.application.use_cases import IngestDocumentUseCase

    try:
        async with session_manager.session() as session:
            use_case = IngestDocumentUseCase(
                documents=DocumentRepository(session),
                embedder=container.embedder,
                index=container.indexer,
                events=container.events,
                settings=container.settings,
            )
            result = await use_case.execute(
                raw=data,
                title=payload.get("title") or "Untitled",
                doc_type=payload.get("doc_type") or "unknown",
                jurisdiction=payload.get("jurisdiction"),
                source_uri=payload.get("source_uri"),
                storage_key=key,
                content_type=payload.get("content_type"),
                owner_id=uuid.UUID(payload["owner_id"]) if payload.get("owner_id") else None,
            )
            await session.commit()
        if job_id:
            await container.jobs.update(
                job_id,
                status=JobStatus.INDEXED,
                document_id=result.document_id,
                chunk_count=result.chunk_count,
            )
    except Exception as exc:
        logger.exception("async_ingestion_failed", job_id=job_id)
        if job_id:
            await container.jobs.update(job_id, status=JobStatus.FAILED, error=str(exc))
        raise


async def main() -> None:
    settings = get_settings()
    configure_logging(f"{settings.service_name}-worker", settings.log_level)
    container = init_container(settings)
    await container.startup()

    consumer = KafkaEventConsumer(
        settings.kafka_bootstrap_servers,
        settings.consumer_group,
        Topics.INGESTION_REQUESTED.value,
    )
    await consumer.start()
    logger.info("ingestion_worker_started")
    try:
        await consumer.run(lambda raw: _handle(raw, container))
    finally:
        await consumer.stop()
        await container.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
