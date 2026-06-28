"""Structured event contracts shared across services (event-driven integration)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, Field

PayloadT = TypeVar("PayloadT", bound=BaseModel)


class Topics(StrEnum):
    INGESTION_REQUESTED = "knowledge.ingestion.requested"
    DOCUMENT_INGESTED = "knowledge.document.ingested"
    AUDIT_LOG = "audit.log"


class EventEnvelope(BaseModel, Generic[PayloadT]):
    """Standard envelope giving every event traceability metadata."""

    event_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_type: str
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    correlation_id: str | None = None
    producer: str
    payload: PayloadT

    def to_json(self) -> bytes:
        return self.model_dump_json().encode("utf-8")


class IngestionRequestedEvent(BaseModel):
    document_id: uuid.UUID | None = None
    job_id: str | None = None
    source_uri: str
    storage_key: str | None = None
    doc_type: str
    jurisdiction: str | None = None
    title: str | None = None
    owner_id: str | None = None
    content_type: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class DocumentIngestedEvent(BaseModel):
    document_id: uuid.UUID
    chunk_count: int
    collection: str
    title: str | None = None
    doc_type: str
    status: str = "indexed"
