"""Force re-index of a single document (by id or corpus source_uri)."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

from app.application.ports import StructuredChunkInput
from app.application.use_cases import IngestDocumentUseCase, IngestionResult
from app.infrastructure.container import get_container
from app.infrastructure.repositories import DocumentRepository
from legalos_common.api.errors import NotFoundError, ValidationFailedError
from legalos_common.logging import get_logger

logger = get_logger(__name__)

ROOT = Path(__file__).resolve().parents[5]  # repo root from .../app/application/
# backend/services/knowledge-ingestion/app/application -> parents[4] is backend, [5] is root
# Actually: application(0)->app(1)->knowledge-ingestion(2)->services(3)->backend(4)->root(5)
# Wait: Path(__file__).parents[0]=application, [1]=app, [2]=knowledge-ingestion, [3]=services, [4]=backend, [5]=repo root. OK.


class ReindexDocumentUseCase:
    def __init__(self, *, ingest: IngestDocumentUseCase, documents: DocumentRepository) -> None:
        self._ingest = ingest
        self._documents = documents

    async def reindex_by_id(self, document_id: uuid.UUID, *, force: bool = True) -> IngestionResult:
        doc = await self._documents.get(document_id)
        if doc is None:
            raise NotFoundError("Document not found")

        source_uri = doc.source_uri or ""
        # Corpus file under raw-data/
        if source_uri and not source_uri.startswith("s3://") and not source_uri.startswith("http"):
            return await self.reindex_by_source_uri(
                source_uri,
                force=force,
                title=doc.title,
                doc_type=doc.doc_type,
                jurisdiction=doc.jurisdiction,
                owner_id=doc.owner_id,
            )

        # Uploaded object in S3/MinIO
        if not doc.storage_key:
            raise ValidationFailedError(
                "Document has no storage_key or corpus source_uri to re-load content"
            )
        container = get_container()
        raw = await container.s3.get_object(doc.storage_key)
        return await self._ingest.execute(
            raw=raw,
            title=doc.title,
            doc_type=doc.doc_type,
            jurisdiction=doc.jurisdiction,
            content_type=doc.content_type,
            source_uri=doc.source_uri,
            storage_key=doc.storage_key,
            owner_id=doc.owner_id,
            force=force,
        )

    async def reindex_by_source_uri(
        self,
        source_uri: str,
        *,
        force: bool = True,
        title: str | None = None,
        doc_type: str | None = None,
        jurisdiction: str | None = None,
        owner_id: uuid.UUID | None = None,
    ) -> IngestionResult:
        scripts = ROOT / "backend" / "scripts"
        if str(scripts) not in sys.path:
            sys.path.insert(0, str(scripts))

        from corpus_sources import PRIORITY_SOURCES, parse_source  # noqa: E402

        entry = next((s for s in PRIORITY_SOURCES if s[0] == source_uri), None)
        if entry is None:
            # Try absolute path or storage-backed source via existing DB row
            existing = await self._documents.find_by_source_uri(source_uri)
            if existing is None:
                raise NotFoundError(f"Unknown corpus source: {source_uri}")
            return await self.reindex_by_id(existing.id, force=force)

        rel, kind, resolved_doc_type = entry
        parsed = parse_source(rel)
        if parsed is None:
            raise ValidationFailedError(f"Could not parse source: {source_uri}")

        if kind == "pdf":
            # Prefer byte ingest for PDFs to keep extract pipeline consistent
            from corpus_sources import RAW_DATA

            raw = (RAW_DATA / rel).read_bytes()
            return await self._ingest.execute(
                raw=raw,
                title=title or parsed.title,
                doc_type=doc_type or resolved_doc_type,
                jurisdiction=jurisdiction or parsed.jurisdiction,
                content_type="application/pdf",
                filename=Path(rel).name,
                source_uri=source_uri,
                owner_id=owner_id,
                force=force,
            )

        structured = [
            StructuredChunkInput(
                content=c.content,
                title=c.title,
                section=c.section,
                citation=c.citation,
                metadata=c.metadata,
            )
            for c in parsed.chunks
        ]
        return await self._ingest.execute_structured(
            title=title or parsed.title,
            doc_type=doc_type or resolved_doc_type,
            jurisdiction=jurisdiction or parsed.jurisdiction,
            structured_chunks=structured,
            source_uri=source_uri,
            content_type=f"application/{kind}",
            page_count=parsed.page_count,
            citations=[c for c in parsed.citations if not c.startswith("dedup_skipped:")],
            content_hash=parsed.content_hash,
            owner_id=owner_id,
            force=force,
        )
