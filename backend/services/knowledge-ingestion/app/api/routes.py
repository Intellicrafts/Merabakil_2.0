"""Knowledge ingestion HTTP routes."""

from __future__ import annotations

import uuid
from dataclasses import asdict

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import build_ingest_use_case
from app.api.schemas import (
    CategoryResponse,
    DocumentSummary,
    IngestionJobResponse,
    IngestionResultResponse,
    IngestStructuredRequest,
    IngestTextRequest,
    KnowledgeGraphResponse,
    ReindexSourceRequest,
)
from app.application.reindex import ReindexDocumentUseCase
from app.application.use_cases import IngestDocumentUseCase, IngestionResult
from app.application.ports import StructuredChunkInput
from app.infrastructure.container import get_container
from app.infrastructure.db import get_session
from app.infrastructure.repositories import DocumentRepository
from legalos_common.api.errors import NotFoundError, ValidationFailedError
from legalos_common.api.pagination import Page, PageParams, paginate
from legalos_common.corpus.registry import get_corpus_registry
from legalos_common.messaging import IngestionRequestedEvent
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions

router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge-ingestion"])

ASYNC_THRESHOLD = 2_097_152


def _to_response(result: IngestionResult) -> IngestionResultResponse:
    return IngestionResultResponse(**asdict(result))


def _doc_summary(d) -> DocumentSummary:  # noqa: ANN001
    return DocumentSummary(
        document_id=str(d.id),
        title=d.title,
        doc_type=d.doc_type,
        jurisdiction=d.jurisdiction,
        chunk_count=d.chunk_count,
        status=d.status,
        source_uri=d.source_uri,
        content_hash=d.content_hash,
        indexed_at=getattr(d, "updated_at", None),
    )


@router.get(
    "/graph",
    response_model=KnowledgeGraphResponse,
    summary="Fetch knowledge graph (documents, citations, references)",
)
async def get_knowledge_graph(
    limit: int = 200,
    _: CurrentUser = Depends(require_permissions(Permission.KNOWLEDGE_INGEST.value)),
) -> KnowledgeGraphResponse:
    container = get_container()
    capped = max(1, min(limit, 500))
    try:
        payload = await container.neo4j.fetch_knowledge_graph(limit=capped)
    except Exception as exc:  # noqa: BLE001 — Neo4j may be down
        raise ValidationFailedError(f"Knowledge graph unavailable: {exc}") from exc
    return KnowledgeGraphResponse(**payload)


@router.get(
    "/categories",
    response_model=list[CategoryResponse],
    summary="List corpus categories for admin upload",
)
async def list_categories(
    _: CurrentUser = Depends(require_permissions(Permission.SEARCH_READ.value)),
) -> list[CategoryResponse]:
    registry = get_corpus_registry()
    return [CategoryResponse(**cat.model_dump()) for cat in registry.categories]


@router.get(
    "/jobs/{job_id}",
    response_model=IngestionJobResponse,
    summary="Get async ingestion job status",
)
async def get_job(
    job_id: str,
    _: CurrentUser = Depends(require_permissions(Permission.KNOWLEDGE_INGEST.value)),
) -> IngestionJobResponse:
    container = get_container()
    job = await container.jobs.get(job_id)
    if job is None:
        raise NotFoundError("Ingestion job not found")
    return IngestionJobResponse(**job.model_dump())


@router.post(
    "/documents",
    response_model=IngestionResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a document from inline text",
)
async def ingest_text(
    body: IngestTextRequest,
    user: CurrentUser = Depends(require_permissions(Permission.KNOWLEDGE_INGEST.value)),
    use_case: IngestDocumentUseCase = Depends(build_ingest_use_case),
) -> IngestionResultResponse:
    result = await use_case.execute(
        raw=body.text.encode("utf-8"),
        title=body.title,
        doc_type=body.doc_type,
        jurisdiction=body.jurisdiction,
        content_type="text/plain",
        owner_id=uuid.UUID(user.user_id),
    )
    return _to_response(result)


@router.post(
    "/documents/structured",
    response_model=IngestionResultResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest pre-chunked structured legal documents (CSV/JSON parsers)",
)
async def ingest_structured(
    body: IngestStructuredRequest,
    user: CurrentUser = Depends(require_permissions(Permission.KNOWLEDGE_INGEST.value)),
    use_case: IngestDocumentUseCase = Depends(build_ingest_use_case),
) -> IngestionResultResponse:
    structured = [
        StructuredChunkInput(
            content=c.content,
            title=c.title,
            section=c.section,
            citation=c.citation,
            metadata=c.metadata,
        )
        for c in body.chunks
    ]
    result = await use_case.execute_structured(
        title=body.title,
        doc_type=body.doc_type,
        jurisdiction=body.jurisdiction,
        structured_chunks=structured,
        source_uri=body.source_file,
        content_type=body.content_type,
        page_count=body.page_count,
        citations=body.citations,
        content_hash=body.content_hash,
        force=body.force,
        owner_id=uuid.UUID(user.user_id),
    )
    return _to_response(result)


@router.post(
    "/documents/upload",
    summary="Upload and ingest a file (PDF/text); stored in S3",
    responses={
        201: {"model": IngestionResultResponse},
        202: {"model": IngestionJobResponse},
    },
)
async def ingest_file(
    title: str = Form(...),
    doc_type: str = Form(...),
    jurisdiction: str | None = Form(None),
    async_mode: bool = Form(False),
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_permissions(Permission.KNOWLEDGE_INGEST.value)),
    use_case: IngestDocumentUseCase = Depends(build_ingest_use_case),
):
    raw = await file.read()
    if not raw:
        raise ValidationFailedError("Uploaded file is empty")

    container = get_container()
    storage_key = f"documents/{uuid.uuid4()}/{file.filename}"
    source_uri = await container.s3.put_object(
        storage_key, raw, content_type=file.content_type or "application/octet-stream"
    )

    use_async = async_mode or len(raw) > container.settings.async_upload_threshold_bytes

    if use_async:
        job = await container.jobs.create(title=title, doc_type=doc_type)
        await container.events.ingestion_requested(
            payload=IngestionRequestedEvent(
                job_id=job.job_id,
                source_uri=source_uri,
                storage_key=storage_key,
                doc_type=doc_type,
                jurisdiction=jurisdiction,
                title=title,
                owner_id=user.user_id,
                content_type=file.content_type,
            ),
            key=job.job_id,
        )
        return JSONResponse(
            status_code=status.HTTP_202_ACCEPTED,
            content=IngestionJobResponse(**job.model_dump()).model_dump(mode="json"),
        )

    result = await use_case.execute(
        raw=raw,
        title=title,
        doc_type=doc_type,
        jurisdiction=jurisdiction,
        content_type=file.content_type,
        filename=file.filename,
        source_uri=source_uri,
        storage_key=storage_key,
        owner_id=uuid.UUID(user.user_id),
    )
    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content=_to_response(result).model_dump(mode="json"),
    )


@router.get(
    "/documents",
    response_model=Page[DocumentSummary],
    summary="List ingested documents",
)
async def list_documents(
    doc_type: str | None = None,
    params: PageParams = Depends(PageParams.as_query),
    _: CurrentUser = Depends(require_permissions(Permission.KNOWLEDGE_INGEST.value)),
    session: AsyncSession = Depends(get_session),
) -> Page[DocumentSummary]:
    repo = DocumentRepository(session)
    docs, total = await repo.list(offset=params.offset, limit=params.size, doc_type=doc_type)
    items = [_doc_summary(d) for d in docs]
    return paginate(items, total, params)


@router.get(
    "/documents/{document_id}",
    response_model=DocumentSummary,
    summary="Get a single document",
)
async def get_document(
    document_id: uuid.UUID,
    _: CurrentUser = Depends(require_permissions(Permission.KNOWLEDGE_INGEST.value)),
    session: AsyncSession = Depends(get_session),
) -> DocumentSummary:
    repo = DocumentRepository(session)
    doc = await repo.get(document_id)
    if doc is None:
        raise NotFoundError("Document not found")
    return _doc_summary(doc)


@router.post(
    "/documents/{document_id}/reindex",
    response_model=IngestionResultResponse,
    summary="Force re-embed and re-index one document",
)
async def reindex_document(
    document_id: uuid.UUID,
    force: bool = True,
    _: CurrentUser = Depends(require_permissions(Permission.KNOWLEDGE_INGEST.value)),
    use_case: IngestDocumentUseCase = Depends(build_ingest_use_case),
    session: AsyncSession = Depends(get_session),
) -> IngestionResultResponse:
    reindex = ReindexDocumentUseCase(
        ingest=use_case,
        documents=DocumentRepository(session),
    )
    result = await reindex.reindex_by_id(document_id, force=force)
    return _to_response(result)


@router.post(
    "/sources/reindex",
    response_model=IngestionResultResponse,
    summary="Force re-ingest one raw-data corpus source by relative path",
)
async def reindex_source(
    body: ReindexSourceRequest,
    user: CurrentUser = Depends(require_permissions(Permission.KNOWLEDGE_INGEST.value)),
    use_case: IngestDocumentUseCase = Depends(build_ingest_use_case),
    session: AsyncSession = Depends(get_session),
) -> IngestionResultResponse:
    reindex = ReindexDocumentUseCase(
        ingest=use_case,
        documents=DocumentRepository(session),
    )
    result = await reindex.reindex_by_source_uri(
        body.source_uri,
        force=body.force,
        owner_id=uuid.UUID(user.user_id),
    )
    return _to_response(result)
