"""Redis-backed ingestion job status tracking."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

import redis.asyncio as aioredis
from pydantic import BaseModel, Field


class JobStatus(StrEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    INDEXED = "indexed"
    FAILED = "failed"


class IngestionJob(BaseModel):
    job_id: str
    status: JobStatus = JobStatus.PENDING
    title: str = ""
    doc_type: str = ""
    document_id: str | None = None
    chunk_count: int = 0
    error: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class IngestionJobStore:
    def __init__(self, redis_url: str, *, ttl_seconds: int = 86_400) -> None:
        self._redis = aioredis.from_url(redis_url, decode_responses=True)
        self._ttl = ttl_seconds
        self._prefix = "ingestion:job:"

    def _key(self, job_id: str) -> str:
        return f"{self._prefix}{job_id}"

    async def create(self, *, title: str, doc_type: str) -> IngestionJob:
        job = IngestionJob(job_id=str(uuid.uuid4()), title=title, doc_type=doc_type)
        await self.save(job)
        return job

    async def get(self, job_id: str) -> IngestionJob | None:
        raw = await self._redis.get(self._key(job_id))
        if not raw:
            return None
        return IngestionJob.model_validate_json(raw)

    async def save(self, job: IngestionJob) -> None:
        job.updated_at = datetime.now(UTC)
        await self._redis.setex(self._key(job.job_id), self._ttl, job.model_dump_json())

    async def update(self, job_id: str, **fields: Any) -> IngestionJob | None:
        job = await self.get(job_id)
        if job is None:
            return None
        for k, v in fields.items():
            setattr(job, k, v)
        await self.save(job)
        return job

    async def close(self) -> None:
        await self._redis.aclose()
