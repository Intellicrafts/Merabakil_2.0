"""Ports for the ingestion domain."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(slots=True)
class StructuredChunkInput:
    content: str
    title: str | None = None
    section: str | None = None
    citation: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class IndexChunk:
    """Flat chunk — used for structured (pre-chunked) ingestion."""

    chunk_id: str
    document_id: str
    content: str
    embedding: list[float]
    title: str | None = None
    doc_type: str | None = None
    jurisdiction: str | None = None
    citation: str | None = None
    section: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class IndexParentChunk:
    """Parent chunk (~1024 chars) — stored for context retrieval, never searched."""

    parent_id: str
    document_id: str
    content: str
    title: str | None = None
    doc_type: str | None = None
    jurisdiction: str | None = None
    citation: str | None = None
    section: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class IndexChildChunk:
    """Child chunk (~256 chars) — embedded and searched via dense + sparse vectors."""

    child_id: str
    parent_id: str
    document_id: str
    content: str
    text_for_embedding: str  # title + section + content for richer semantic signal
    embedding: list[float]
    title: str | None = None
    doc_type: str | None = None
    jurisdiction: str | None = None
    citation: str | None = None
    section: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class KnowledgeIndexPort(Protocol):
    """Writes chunks to the vector store and knowledge graph."""

    async def index_parent_children(
        self,
        parents: list[IndexParentChunk],
        children: list[IndexChildChunk],
    ) -> None: ...

    async def index_chunks(self, chunks: list[IndexChunk]) -> None: ...

    async def register_document(
        self, *, document_id: str, title: str, doc_type: str, jurisdiction: str | None
    ) -> None: ...

    async def link_citations(self, *, document_id: str, citations: list[str]) -> None: ...

    async def purge_document(self, document_id: str) -> None: ...


class EventPublisherPort(Protocol):
    async def document_ingested(
        self, *, document_id: str, chunk_count: int, doc_type: str, title: str | None
    ) -> None: ...
