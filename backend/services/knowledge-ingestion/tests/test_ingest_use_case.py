from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

import pytest

from app.application.ports import IndexChunk
from app.application.use_cases import IngestDocumentUseCase
from app.config import get_settings
from legalos_common.clients.llm import StubEmbeddingClient


@dataclass
class FakeDoc:
    id: uuid.UUID
    chunk_count: int = 0
    page_count: int | None = None
    status: str = "processing"
    doc_metadata: dict[str, Any] = field(default_factory=dict)


class FakeDocumentRepository:
    def __init__(self) -> None:
        self.docs: dict[uuid.UUID, FakeDoc] = {}

    async def create(self, **_: Any) -> FakeDoc:
        doc = FakeDoc(id=uuid.uuid4())
        self.docs[doc.id] = doc
        return doc

    async def mark_indexed(self, doc: FakeDoc, *, chunk_count, page_count, metadata) -> None:
        doc.chunk_count = chunk_count
        doc.page_count = page_count
        doc.doc_metadata = metadata
        doc.status = "indexed"


class FakeIndex:
    def __init__(self) -> None:
        self.chunks: list[IndexChunk] = []
        self.documents: list[str] = []
        self.citations: list[str] = []

    async def index_chunks(self, chunks: list[IndexChunk]) -> None:
        self.chunks.extend(chunks)

    async def register_document(self, **kwargs: Any) -> None:
        self.documents.append(kwargs["document_id"])

    async def link_citations(self, *, document_id: str, citations: list[str]) -> None:
        self.citations.extend(citations)


class FakeEvents:
    def __init__(self) -> None:
        self.published: list[dict] = []

    async def document_ingested(self, **kwargs: Any) -> None:
        self.published.append(kwargs)


@pytest.mark.asyncio
async def test_ingest_pipeline_end_to_end() -> None:
    settings = get_settings()
    index = FakeIndex()
    events = FakeEvents()
    use_case = IngestDocumentUseCase(
        documents=FakeDocumentRepository(),
        embedder=StubEmbeddingClient(settings.llm.embedding_dim),
        index=index,
        events=events,
        settings=settings,
    )

    text = (
        "The Indian Contract Act, 1872 governs agreements. "
        "See Section 10 and AIR 1973 SC 1461.\n\n" + "Clause content. " * 200
    )
    result = await use_case.execute(
        raw=text.encode("utf-8"),
        title="Contract Law Primer",
        doc_type="commentary",
        jurisdiction="india",
    )

    assert result.status == "indexed"
    assert result.chunk_count >= 1
    assert len(index.chunks) == result.chunk_count
    assert index.documents == [result.document_id]
    assert any("AIR 1973 SC 1461" in c for c in result.citations)
    assert len(events.published) == 1
    # Every indexed chunk carries an embedding of the configured dimension.
    assert all(len(c.embedding) == settings.llm.embedding_dim for c in index.chunks)


@pytest.mark.asyncio
async def test_ingest_rejects_empty_document() -> None:
    settings = get_settings()
    use_case = IngestDocumentUseCase(
        documents=FakeDocumentRepository(),
        embedder=StubEmbeddingClient(settings.llm.embedding_dim),
        index=FakeIndex(),
        events=FakeEvents(),
        settings=settings,
    )
    with pytest.raises(ValueError, match="No extractable text"):
        await use_case.execute(raw=b"   ", title="Empty", doc_type="unknown")


@pytest.mark.asyncio
async def test_structured_ingest_preserves_chunk_boundaries() -> None:
    from app.application.ports import StructuredChunkInput

    settings = get_settings()
    index = FakeIndex()
    events = FakeEvents()
    use_case = IngestDocumentUseCase(
        documents=FakeDocumentRepository(),
        embedder=StubEmbeddingClient(settings.llm.embedding_dim),
        index=index,
        events=events,
        settings=settings,
    )
    structured = [
        StructuredChunkInput(
            content="Article 19 — freedom of speech and expression.",
            title="Article 19",
            section="19",
            citation="Constitution of India",
            metadata={"article_number": "19"},
        ),
        StructuredChunkInput(
            content="Article 21 — protection of life and personal liberty.",
            title="Article 21",
            section="21",
            metadata={"article_number": "21"},
        ),
    ]
    result = await use_case.execute_structured(
        title="Constitution sample",
        doc_type="constitution",
        jurisdiction="india",
        structured_chunks=structured,
        citations=["Constitution of India"],
    )
    assert result.chunk_count == 2
    assert len(index.chunks) == 2
    assert index.chunks[0].metadata.get("article_number") == "19"
