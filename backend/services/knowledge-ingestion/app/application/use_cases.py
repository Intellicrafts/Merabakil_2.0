"""Knowledge ingestion use case — parent-child chunking + Qdrant-native hybrid storage."""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass

from app.application.ports import (
    EventPublisherPort,
    IndexChunk,
    IndexChildChunk,
    IndexParentChunk,
    KnowledgeIndexPort,
    StructuredChunkInput,
)
from app.config import IngestionSettings
from app.infrastructure.repositories import DocumentRepository
from app.pipeline import clean_text, extract_metadata, extract_text, parent_child_split
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
    status: str  # indexed | reindexed | unchanged
    chunks_embedded: int = 0


def _hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


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

    async def _embed_texts(self, texts: list[str]) -> list[list[float]]:
        batch_size = self._settings.embedding_batch_size
        embeddings: list[list[float]] = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            embeddings.extend(await self._embedder.embed(batch))
        return embeddings

    async def _resolve_document(
        self,
        *,
        source_uri: str | None,
        content_hash: str,
        force: bool,
        title: str,
        doc_type: str,
        jurisdiction: str | None,
        content_type: str | None,
        storage_key: str | None,
        owner_id: uuid.UUID | None,
    ):
        existing = await self._documents.find_by_source_uri(source_uri) if source_uri else None
        if existing and existing.content_hash == content_hash and not force:
            return existing, "unchanged"
        if existing:
            await self._index.purge_document(str(existing.id))
            doc = await self._documents.prepare_for_reindex(
                existing,
                title=title,
                doc_type=doc_type,
                jurisdiction=jurisdiction,
                content_type=content_type,
                storage_key=storage_key,
                content_hash=content_hash,
            )
            return doc, "reindexed"
        doc = await self._documents.create(
            title=title,
            doc_type=doc_type,
            jurisdiction=jurisdiction,
            source_uri=source_uri,
            storage_key=storage_key,
            content_type=content_type,
            owner_id=owner_id,
            content_hash=content_hash,
        )
        return doc, "indexed"

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
        force: bool = False,
    ) -> IngestionResult:
        text, page_count = extract_text(
            raw,
            content_type=content_type,
            filename=filename,
            enable_ocr=self._settings.enable_ocr,
        )
        cleaned = clean_text(text)
        if not cleaned:
            raise ValueError("No extractable text found in the document")

        meta = extract_metadata(cleaned)
        resolved_jurisdiction = jurisdiction or meta.detected_jurisdiction
        content_hash = _hash_text(cleaned)

        doc, status = await self._resolve_document(
            source_uri=source_uri,
            content_hash=content_hash,
            force=force,
            title=title,
            doc_type=doc_type,
            jurisdiction=resolved_jurisdiction,
            content_type=content_type,
            storage_key=storage_key,
            owner_id=owner_id,
        )
        document_id = str(doc.id)

        if status == "unchanged":
            return IngestionResult(
                document_id=document_id,
                title=title,
                doc_type=doc_type,
                jurisdiction=resolved_jurisdiction,
                chunk_count=doc.chunk_count,
                page_count=doc.page_count,
                citations=list((doc.doc_metadata or {}).get("citations") or []),
                status="unchanged",
                chunks_embedded=0,
            )

        # Parent-child split: parents ~1024 chars (context), children ~256 chars (searched)
        first_section = meta.sections[0] if meta.sections else ""
        pairs = parent_child_split(
            cleaned,
            document_id,
            title=title,
            section=first_section,
            parent_size=self._settings.parent_chunk_size,
            child_size=self._settings.child_chunk_size,
            child_overlap=self._settings.child_chunk_overlap,
        )

        all_parents: list[IndexParentChunk] = []
        all_raw_children = []
        for parent_chunk, child_chunks in pairs:
            all_parents.append(
                IndexParentChunk(
                    parent_id=parent_chunk.parent_id,
                    document_id=document_id,
                    content=parent_chunk.content,
                    title=title,
                    doc_type=doc_type,
                    jurisdiction=resolved_jurisdiction,
                    citation=meta.citations[0] if meta.citations else None,
                    section=first_section or None,
                )
            )
            all_raw_children.extend(child_chunks)

        # Embed children using text_for_embedding (title + section + child content)
        texts_for_embedding = [c.text_for_embedding for c in all_raw_children]
        embeddings = await self._embed_texts(texts_for_embedding)

        all_children: list[IndexChildChunk] = [
            IndexChildChunk(
                child_id=rc.child_id,
                parent_id=rc.parent_id,
                document_id=document_id,
                content=rc.content,
                text_for_embedding=rc.text_for_embedding,
                embedding=emb,
                title=title,
                doc_type=doc_type,
                jurisdiction=resolved_jurisdiction,
                citation=meta.citations[0] if meta.citations else None,
                section=first_section or None,
                metadata={"chunk_index": idx},
            )
            for idx, (rc, emb) in enumerate(zip(all_raw_children, embeddings, strict=True))
        ]

        await self._index.index_parent_children(all_parents, all_children)
        await self._index.register_document(
            document_id=document_id,
            title=title,
            doc_type=doc_type,
            jurisdiction=resolved_jurisdiction,
        )
        await self._index.link_citations(document_id=document_id, citations=meta.citations)

        total_children = len(all_children)
        await self._documents.mark_indexed(
            doc,
            chunk_count=total_children,
            page_count=page_count,
            metadata={
                "citations": meta.citations,
                "sections": meta.sections,
                "articles": meta.articles,
                "acts": meta.acts,
                "parent_count": len(all_parents),
                "child_count": total_children,
            },
            content_hash=content_hash,
        )
        await self._events.document_ingested(
            document_id=document_id, chunk_count=total_children, doc_type=doc_type, title=title
        )

        logger.info(
            "document_ingested",
            document_id=document_id,
            parents=len(all_parents),
            children=total_children,
            status=status,
            doc_type=doc_type,
        )
        return IngestionResult(
            document_id=document_id,
            title=title,
            doc_type=doc_type,
            jurisdiction=resolved_jurisdiction,
            chunk_count=total_children,
            page_count=page_count,
            citations=meta.citations,
            status=status,
            chunks_embedded=total_children,
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
        content_hash: str | None = None,
        force: bool = False,
    ) -> IngestionResult:
        """Flat ingestion for pre-chunked structured inputs (no parent-child splitting)."""
        if not structured_chunks:
            raise ValueError("No structured chunks provided")

        combined = "\n".join(c.content for c in structured_chunks)
        resolved_hash = content_hash or _hash_text(combined)

        doc, status = await self._resolve_document(
            source_uri=source_uri,
            content_hash=resolved_hash,
            force=force,
            title=title,
            doc_type=doc_type,
            jurisdiction=jurisdiction,
            content_type=content_type,
            storage_key=storage_key,
            owner_id=owner_id,
        )
        document_id = str(doc.id)

        if status == "unchanged":
            return IngestionResult(
                document_id=document_id,
                title=title,
                doc_type=doc_type,
                jurisdiction=jurisdiction,
                chunk_count=doc.chunk_count,
                page_count=doc.page_count,
                citations=citations or [],
                status="unchanged",
                chunks_embedded=0,
            )

        texts = [c.content for c in structured_chunks]
        embeddings = await self._embed_texts(texts)
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

        await self._documents.mark_indexed(
            doc,
            chunk_count=len(structured_chunks),
            page_count=page_count,
            metadata={"structured_ingestion": True, "chunk_count": len(structured_chunks)},
            content_hash=resolved_hash,
        )
        await self._events.document_ingested(
            document_id=document_id,
            chunk_count=len(structured_chunks),
            doc_type=doc_type,
            title=title,
        )

        logger.info(
            "structured_document_ingested",
            document_id=document_id,
            chunks=len(structured_chunks),
            status=status,
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
            status=status,
            chunks_embedded=len(structured_chunks),
        )
