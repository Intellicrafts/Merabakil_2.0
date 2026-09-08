"""Document persistence repository scoped to owner access."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select, text as sql_text
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
        owner_id: uuid.UUID,
        visibility: str,
        case_id: uuid.UUID | None = None,
    ) -> Document:
        doc = Document(
            title=title,
            doc_type=doc_type,
            jurisdiction=jurisdiction,
            source_uri=source_uri,
            storage_key=storage_key,
            content_type=content_type,
            owner_id=owner_id,
            visibility=visibility,
            case_id=case_id,
            status="pending",
        )
        self._session.add(doc)
        await self._session.flush()
        return doc

    async def get_for_owner(self, document_id: uuid.UUID, owner_id: uuid.UUID) -> Document | None:
        stmt = select(Document).where(
            Document.id == document_id,
            Document.owner_id == owner_id,
            Document.status != "deleted",
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_owner(
        self,
        *,
        owner_id: uuid.UUID,
        offset: int,
        limit: int,
        case_id: uuid.UUID | None = None,
    ) -> tuple[list[Document], int]:
        base = select(Document).where(
            Document.owner_id == owner_id,
            Document.status != "deleted",
        )
        if case_id is not None:
            base = base.where(Document.case_id == case_id)
        count_stmt = select(func.count()).select_from(base.subquery())
        total = await self._session.scalar(count_stmt) or 0
        result = await self._session.execute(
            base.order_by(Document.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total

    async def list_for_case(
        self,
        *,
        case_id: uuid.UUID,
        requester_id: uuid.UUID,
    ) -> list[Document]:
        """Return documents for a case if the requester is the owner OR linked via a consultation."""
        access_sql = sql_text(
            "SELECT 1 FROM consultations "
            "WHERE case_id = :case_id AND lawyer_user_id = :requester_id LIMIT 1"
        )
        result = await self._session.execute(
            access_sql, {"case_id": case_id, "requester_id": requester_id}
        )
        has_consultation_access = result.scalar() is not None

        stmt = select(Document).where(
            Document.case_id == case_id,
            Document.status != "deleted",
        )
        if not has_consultation_access:
            stmt = stmt.where(Document.owner_id == requester_id)

        result = await self._session.execute(stmt.order_by(Document.created_at.desc()))
        return list(result.scalars().all())

    async def soft_delete(self, doc: Document) -> None:
        doc.status = "deleted"
        await self._session.flush()

    async def update_metadata(self, doc: Document, metadata: dict[str, Any]) -> None:
        doc.doc_metadata = {**doc.doc_metadata, **metadata}
        await self._session.flush()

    async def update_extraction(
        self,
        doc: Document,
        *,
        status: str,
        page_count: int | None,
        extract_key: str | None,
        extracted_text: str,
        error: str | None = None,
    ) -> None:
        meta = {**(doc.doc_metadata or {}), "extract_key": extract_key}
        if error:
            meta["extract_error"] = error
        doc.status = status
        doc.page_count = page_count
        doc.doc_metadata = meta
        await self._session.flush()
