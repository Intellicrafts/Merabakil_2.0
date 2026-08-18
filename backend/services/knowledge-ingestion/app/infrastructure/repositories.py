"""Document persistence repository."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models import Document


class DocumentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(
        self,
        *,
        title: str,
        doc_type: str,
        jurisdiction: str | None,
        source_uri: str | None,
        storage_key: str | None,
        content_type: str | None,
        owner_id: uuid.UUID | None,
        content_hash: str | None = None,
    ) -> Document:
        doc = Document(
            title=title,
            doc_type=doc_type,
            jurisdiction=jurisdiction,
            source_uri=source_uri,
            storage_key=storage_key,
            content_type=content_type,
            owner_id=owner_id,
            content_hash=content_hash,
            status="processing",
        )
        self._session.add(doc)
        await self._session.flush()
        return doc

    async def find_by_source_uri(self, source_uri: str) -> Document | None:
        result = await self._session.execute(
            select(Document)
            .where(Document.source_uri == source_uri)
            .order_by(Document.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get(self, document_id: uuid.UUID) -> Document | None:
        return await self._session.get(Document, document_id)

    async def prepare_for_reindex(
        self,
        doc: Document,
        *,
        title: str,
        doc_type: str,
        jurisdiction: str | None,
        content_type: str | None = None,
        storage_key: str | None = None,
        content_hash: str | None = None,
    ) -> Document:
        doc.title = title
        doc.doc_type = doc_type
        doc.jurisdiction = jurisdiction
        if content_type is not None:
            doc.content_type = content_type
        if storage_key is not None:
            doc.storage_key = storage_key
        doc.content_hash = content_hash
        doc.status = "processing"
        await self._session.flush()
        return doc

    async def mark_indexed(
        self,
        doc: Document,
        *,
        chunk_count: int,
        page_count: int | None,
        metadata: dict[str, Any],
        content_hash: str | None = None,
    ) -> None:
        doc.chunk_count = chunk_count
        doc.page_count = page_count
        doc.status = "indexed"
        doc.doc_metadata = metadata
        if content_hash is not None:
            doc.content_hash = content_hash
        await self._session.flush()

    async def list(
        self, *, offset: int, limit: int, doc_type: str | None
    ) -> tuple[list[Document], int]:
        stmt = select(Document)
        count_stmt = select(func.count()).select_from(Document)
        if doc_type:
            stmt = stmt.where(Document.doc_type == doc_type)
            count_stmt = count_stmt.where(Document.doc_type == doc_type)
        total = await self._session.scalar(count_stmt) or 0
        result = await self._session.execute(
            stmt.order_by(Document.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total
