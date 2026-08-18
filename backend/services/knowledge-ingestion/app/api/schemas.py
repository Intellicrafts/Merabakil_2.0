from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class IngestTextRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    doc_type: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=1)
    jurisdiction: str | None = None


class StructuredChunkRequest(BaseModel):
    content: str = Field(min_length=1)
    title: str | None = None
    section: str | None = None
    citation: str | None = None
    metadata: dict = Field(default_factory=dict)


class IngestStructuredRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    doc_type: str = Field(min_length=1, max_length=120)
    jurisdiction: str | None = None
    content_type: str | None = None
    source_file: str | None = None
    page_count: int | None = None
    citations: list[str] = Field(default_factory=list)
    chunks: list[StructuredChunkRequest] = Field(min_length=1)
    content_hash: str | None = None
    force: bool = False


class IngestionResultResponse(BaseModel):
    document_id: str
    title: str
    doc_type: str
    jurisdiction: str | None
    chunk_count: int
    page_count: int | None
    citations: list[str]
    status: str
    chunks_embedded: int = 0


class DocumentSummary(BaseModel):
    document_id: str
    title: str
    doc_type: str
    jurisdiction: str | None
    chunk_count: int
    status: str
    source_uri: str | None = None
    content_hash: str | None = None
    indexed_at: datetime | None = None


class ReindexSourceRequest(BaseModel):
    source_uri: str = Field(min_length=1)
    force: bool = True


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


class KnowledgeGraphNode(BaseModel):
    id: str
    label: str
    type: str
    doc_type: str | None = None
    jurisdiction: str | None = None
    document_id: str | None = None
    key: str | None = None


class KnowledgeGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str = "CITES"


class KnowledgeGraphStats(BaseModel):
    documents: int = 0
    references: int = 0
    citations: int = 0


class KnowledgeGraphResponse(BaseModel):
    nodes: list[KnowledgeGraphNode]
    edges: list[KnowledgeGraphEdge]
    stats: KnowledgeGraphStats
