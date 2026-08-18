from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

import pytest

from app.application.ports import IndexChunk, IndexChildChunk, IndexParentChunk
from app.application.use_cases import IngestDocumentUseCase
from app.config import get_settings
from legalos_common.clients.llm import StubEmbeddingClient


@dataclass
class FakeDoc:
    id: uuid.UUID
    chunk_count: int = 0
    page_count: int | None = None
    status: str = "processing"
    source_uri: str | None = None
    content_hash: str | None = None
    doc_metadata: dict[str, Any] = field(default_factory=dict)


class FakeDocumentRepository:
    def __init__(self) -> None:
        self.docs: dict[uuid.UUID, FakeDoc] = {}

    async def create(self, **kwargs: Any) -> FakeDoc:
        doc = FakeDoc(
            id=uuid.uuid4(),
            source_uri=kwargs.get("source_uri"),
            content_hash=kwargs.get("content_hash"),
        )
        self.docs[doc.id] = doc
        return doc

    async def find_by_source_uri(self, source_uri: str) -> FakeDoc | None:
        for doc in self.docs.values():
            if doc.source_uri == source_uri:
                return doc
        return None

    async def get(self, document_id: uuid.UUID) -> FakeDoc | None:
        return self.docs.get(document_id)

    async def prepare_for_reindex(self, doc: FakeDoc, **kwargs: Any) -> FakeDoc:
        doc.status = "processing"
        doc.content_hash = kwargs.get("content_hash", doc.content_hash)
        return doc

    async def mark_indexed(
        self, doc: FakeDoc, *, chunk_count, page_count, metadata, content_hash=None
    ) -> None:
        doc.chunk_count = chunk_count
        doc.page_count = page_count
        doc.doc_metadata = metadata
        doc.status = "indexed"
        if content_hash is not None:
            doc.content_hash = content_hash


class FakeIndex:
    def __init__(self) -> None:
        self.chunks: list[IndexChunk] = []
        self.children: list[IndexChildChunk] = []
        self.parents: list[IndexParentChunk] = []
        self.documents: list[str] = []
        self.citations: list[str] = []
        self.purged: list[str] = []

    async def index_parent_children(
        self, parents: list[IndexParentChunk], children: list[IndexChildChunk]
    ) -> None:
        self.parents.extend(parents)
        self.children.extend(children)

    async def index_chunks(self, chunks: list[IndexChunk]) -> None:
        self.chunks.extend(chunks)

    async def register_document(self, **kwargs: Any) -> None:
        self.documents.append(kwargs["document_id"])

    async def link_citations(self, *, document_id: str, citations: list[str]) -> None:
        self.citations.extend(citations)

    async def purge_document(self, document_id: str) -> None:
        self.purged.append(document_id)
        self.chunks = [c for c in self.chunks if c.document_id != document_id]
        self.children = [c for c in self.children if c.document_id != document_id]
        self.parents = [p for p in self.parents if p.document_id != document_id]


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
    # execute() uses parent-child chunking: results land in index.children
    assert len(index.children) == result.chunk_count
    assert len(index.parents) >= 1
    assert index.documents == [result.document_id]
    assert any("AIR 1973 SC 1461" in c for c in result.citations)
    assert len(events.published) == 1
    # Every child chunk carries an embedding of the configured dimension.
    assert all(len(c.embedding) == settings.llm.embedding_dim for c in index.children)


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


@pytest.mark.asyncio
async def test_structured_ingest_skips_unchanged_hash() -> None:
    from app.application.ports import StructuredChunkInput

    settings = get_settings()
    index = FakeIndex()
    docs = FakeDocumentRepository()
    use_case = IngestDocumentUseCase(
        documents=docs,
        embedder=StubEmbeddingClient(settings.llm.embedding_dim),
        index=index,
        events=FakeEvents(),
        settings=settings,
    )
    structured = [
        StructuredChunkInput(content="Article 14 — equality.", title="Article 14", section="14"),
    ]
    first = await use_case.execute_structured(
        title="Constitution sample",
        doc_type="constitution",
        jurisdiction="india",
        structured_chunks=structured,
        source_uri="Indian_constitution/Indian_constitution.json",
        content_hash="abc123",
    )
    assert first.status == "indexed"
    assert len(index.chunks) == 1

    second = await use_case.execute_structured(
        title="Constitution sample",
        doc_type="constitution",
        jurisdiction="india",
        structured_chunks=structured,
        source_uri="Indian_constitution/Indian_constitution.json",
        content_hash="abc123",
        force=False,
    )
    assert second.status == "unchanged"
    assert second.chunks_embedded == 0
    assert len(index.chunks) == 1
    assert index.purged == []

    third = await use_case.execute_structured(
        title="Constitution sample",
        doc_type="constitution",
        jurisdiction="india",
        structured_chunks=structured,
        source_uri="Indian_constitution/Indian_constitution.json",
        content_hash="abc123",
        force=True,
    )
    assert third.status == "reindexed"
    assert index.purged == [first.document_id]
    assert len(index.chunks) == 1

