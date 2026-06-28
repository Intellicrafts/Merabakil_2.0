from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class IngestTextRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    doc_type: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1)
    jurisdiction: str | None = None


class IngestionResultResponse(BaseModel):
    document_id: str
    title: str
    doc_type: str
    jurisdiction: str | None
    chunk_count: int
    page_count: int | None
    citations: list[str]
    status: str


class DocumentSummary(BaseModel):
    document_id: str
    title: str
    doc_type: str
    jurisdiction: str | None
    chunk_count: int
    status: str


class CategoryResponse(BaseModel):
    folder: str
    doc_type: str
    jurisdiction: str
    purpose: str
    answers_for: list[str]
    pdf_examples: list[str]
    recommended_min_pdfs: int
    recommended_optimal_pdfs: int
    ingestion_tips: str


class IngestionJobResponse(BaseModel):
    job_id: str
    status: str
    title: str = ""
    doc_type: str = ""
    document_id: str | None = None
    chunk_count: int = 0
    error: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
