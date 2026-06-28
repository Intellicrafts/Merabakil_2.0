from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    document_id: str
    title: str
    doc_type: str
    jurisdiction: str | None
    visibility: str
    status: str
    chunk_count: int
    content_type: str | None = None
    created_at: datetime | None = None


class UploadDocumentResponse(BaseModel):
    document_id: str
    title: str
    doc_type: str
    jurisdiction: str | None
    visibility: str
    status: str
    source_uri: str | None = None
