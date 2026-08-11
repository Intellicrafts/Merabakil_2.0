"""Knowledge ingestion use case (orchestrates the full RAG ingestion pipeline)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.application.ports import (
    EventPublisherPort,
    IndexChunk,
    KnowledgeIndexPort,
    StructuredChunkInput,
)
from app.config import IngestionSettings
from app.infrastructure.repositories import DocumentRepository
from app.pipeline import chunk_text, clean_text, extract_metadata, extract_text
from legalos_common.clients.llm import EmbeddingClient
from legalos_common.logging import get_logger

logger = get_logger(__name__)


@dataclass(slots=True)
class IngestionResult:
    document_id: str
    title: str
    doc_type: str
    jurisdiction: str | None
    chunk_count: int
    page_count: int | None
    citations: list[str]
    status: str


class IngestDocumentUseCase:
    def __init__(
        self,
        *,
        documents: DocumentRepository,
        embedder: EmbeddingClient,
        index: KnowledgeIndexPort,
        events: EventPublisherPort,
        settings: IngestionSettings,
    ) -> None:
        self._documents = documents
        self._embedder = embedder
        self._index = index
        self._events = events
        self._settings = settings

    async def execute(
        self,
        *,
        raw: bytes,
        title: str,
        doc_type: str,
        jurisdiction: str | None = None,
        content_type: str | None = None,
        filename: str | None = None,
        source_uri: str | None = None,
        storage_key: str | None = None,
        owner_id: uuid.UUID | None = None,
    ) -> IngestionResult:
        # 1. Extract + clean.
        text, page_count = extract_text(
            raw,
            content_type=content_type,
            filename=filename,
            enable_ocr=self._settings.enable_ocr,
        )
        cleaned = clean_text(text)
        if not cleaned:
            raise ValueError("No extractable text found in the document")

        # 2. Metadata + chunking.
        meta = extract_metadata(cleaned)
        resolved_jurisdiction = jurisdiction or meta.detected_jurisdiction
        chunks = chunk_text(
            cleaned,
            chunk_size=self._settings.chunk_size,
            overlap=self._settings.chunk_overlap,
        )

        # 3. Persist document row.
        doc = await self._documents.create(
            title=title,
            doc_type=doc_type,
            jurisdiction=resolved_jurisdiction,
            source_uri=source_uri,
            storage_key=storage_key,
            content_type=content_type,
            owner_id=owner_id,
        )
        document_id = str(doc.id)

        # 4. Embed (batched).
        texts = [c.text for c in chunks]
        batch_size = self._settings.embedding_batch_size
        embeddings: list[list[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            embeddings.extend(await self._embedder.embed(batch))

        # 5. Index to vector + keyword stores (parallel).
        import asyncio

        index_chunks = [
            IndexChunk(
                chunk_id=f"{document_id}:{c.index}",
                document_id=document_id,
                content=c.text,
                embedding=emb,
                title=title,
                doc_type=doc_type,
                jurisdiction=resolved_jurisdiction,
                citation=meta.citations[0] if meta.citations else None,
                section=meta.sections[0] if meta.sections else None,
                metadata={"chunk_index": c.index},
            )
            for c, emb in zip(chunks, embeddings, strict=True)
        ]
        await self._index.index_chunks(index_chunks)

        # 6. Knowledge graph.
        await self._index.register_document(
            document_id=document_id,
            title=title,
            doc_type=doc_type,
            jurisdiction=resolved_jurisdiction,
        )
        await self._index.link_citations(document_id=document_id, citations=meta.citations)

        # 7. Finalise + emit event.
        metadata_payload = {
            "citations": meta.citations,
            "sections": meta.sections,
            "articles": meta.articles,
            "acts": meta.acts,
        }
        await self._documents.mark_indexed(
            doc, chunk_count=len(chunks), page_count=page_count, metadata=metadata_payload
        )
        await self._events.document_ingested(
            document_id=document_id, chunk_count=len(chunks), doc_type=doc_type, title=title
        )

        logger.info(
            "document_ingested",
            document_id=document_id,
            chunks=len(chunks),
            doc_type=doc_type,
        )
        return IngestionResult(
            document_id=document_id,
            title=title,
            doc_type=doc_type,
            jurisdiction=resolved_jurisdiction,
            chunk_count=len(chunks),
            page_count=page_count,
            citations=meta.citations,
            status="indexed",
        )

    async def execute_structured(
        self,
        *,
        title: str,
        doc_type: str,
        jurisdiction: str | None,
        structured_chunks: list[StructuredChunkInput],
        source_uri: str | None = None,
        storage_key: str | None = None,
        owner_id: uuid.UUID | None = None,
        page_count: int | None = None,
        citations: list[str] | None = None,
        content_type: str | None = None,
    ) -> IngestionResult:
        if not structured_chunks:
            raise ValueError("No structured chunks provided")

        doc = await self._documents.create(
            title=title,
            doc_type=doc_type,
            jurisdiction=jurisdiction,
            source_uri=source_uri,
            storage_key=storage_key,
            content_type=content_type,
            owner_id=owner_id,
        )
        document_id = str(doc.id)

        texts = [c.content for c in structured_chunks]
        batch_size = self._settings.embedding_batch_size
        embeddings: list[list[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            embeddings.extend(await self._embedder.embed(batch))

        index_chunks = [
            IndexChunk(
                chunk_id=f"{document_id}:{idx}",
                document_id=document_id,
                content=chunk.content,
                embedding=emb,
                title=chunk.title or title,
                doc_type=doc_type,
                jurisdiction=jurisdiction,
                citation=chunk.citation,
                section=chunk.section,
                metadata={"chunk_index": idx, **chunk.metadata},
            )
            for idx, (chunk, emb) in enumerate(zip(structured_chunks, embeddings, strict=True))
        ]
        await self._index.index_chunks(index_chunks)
        await self._index.register_document(
            document_id=document_id,
            title=title,
            doc_type=doc_type,
            jurisdiction=jurisdiction,
        )
        resolved_citations = citations or []
        await self._index.link_citations(document_id=document_id, citations=resolved_citations)

        metadata_payload = {
            "structured_ingestion": True,
            "chunk_count": len(structured_chunks),
        }
        await self._documents.mark_indexed(
            doc, chunk_count=len(structured_chunks), page_count=page_count, metadata=metadata_payload
        )
        await self._events.document_ingested(
            document_id=document_id, chunk_count=len(structured_chunks), doc_type=doc_type, title=title
        )

        logger.info(
            "structured_document_ingested",
            document_id=document_id,
            chunks=len(structured_chunks),
            doc_type=doc_type,
        )
        return IngestionResult(
            document_id=document_id,
            title=title,
            doc_type=doc_type,
            jurisdiction=jurisdiction,
            chunk_count=len(structured_chunks),
            page_count=page_count,
            citations=resolved_citations,
            status="indexed",
        )
