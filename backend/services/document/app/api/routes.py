"""Document management HTTP routes."""

from __future__ import annotations

import uuid
from pathlib import PurePath

from legalos_common.logging import get_logger

logger = get_logger(__name__)

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import Response
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_document_repository
from app.api.schemas import DocumentResponse, DocumentTextResponse, UploadDocumentResponse
from app.config import get_settings
from app.infrastructure.container import get_container
from app.infrastructure.db import get_session
from app.infrastructure.extract import extract_document_text
from app.infrastructure.repositories import DocumentRepository
from legalos_common.api.errors import NotFoundError, ValidationFailedError
from legalos_common.api.pagination import Page, PageParams, paginate
from legalos_common.messaging import IngestionRequestedEvent
from legalos_common.security.rbac import (
    CurrentUser,
    Permission,
    bearer_scheme,
    require_permissions,
)

router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

VISIBILITY_CHOICES = frozenset({"private", "corpus"})
ALLOWED_SUFFIXES = frozenset({".pdf", ".doc", ".docx", ".txt", ".csv", ".md"})


def _filename_from_key(storage_key: str | None) -> str | None:
    if not storage_key:
        return None
    return PurePath(storage_key).name


def _validate_upload(filename: str | None, raw: bytes, max_bytes: int) -> None:
    if not raw:
        raise ValidationFailedError("Uploaded file is empty")
    if len(raw) > max_bytes:
        raise ValidationFailedError(f"File exceeds the {max_bytes // (1024 * 1024)} MB limit")
    suffix = PurePath(filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise ValidationFailedError(
            "Unsupported file type. Upload PDF, Word, text, CSV, or Markdown."
        )


def _to_response(doc) -> DocumentResponse:
    return DocumentResponse(
        document_id=str(doc.id),
        title=doc.title,
        doc_type=doc.doc_type,
        jurisdiction=doc.jurisdiction,
        visibility=doc.visibility,
        status=doc.status,
        chunk_count=doc.chunk_count,
        content_type=doc.content_type,
        created_at=doc.created_at,
        case_id=str(doc.case_id) if doc.case_id else None,
    )


@router.post(
    "/upload",
    response_model=UploadDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document and trigger ingestion",
)
async def upload_document(
    title: str = Form(...),
    doc_type: str = Form(...),
    jurisdiction: str | None = Form(None),
    visibility: str = Form("private"),
    case_id: str | None = Form(None),
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_permissions(Permission.DOCUMENT_WRITE.value)),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    repo: DocumentRepository = Depends(get_document_repository),
    session: AsyncSession = Depends(get_session),
) -> UploadDocumentResponse:
    if visibility not in VISIBILITY_CHOICES:
        raise ValidationFailedError(
            f"visibility must be one of: {', '.join(sorted(VISIBILITY_CHOICES))}"
        )

    raw = await file.read()
    settings = get_settings()
    _validate_upload(file.filename, raw, settings.max_upload_bytes)

    parsed_case_id: uuid.UUID | None = None
    if case_id:
        try:
            parsed_case_id = uuid.UUID(case_id)
        except ValueError:
            raise ValidationFailedError("case_id must be a valid UUID")

    container = get_container()
    owner_id = uuid.UUID(user.user_id)
    doc_uuid = uuid.uuid4()
    safe_name = PurePath(file.filename or "upload.bin").name or "upload.bin"
    storage_key = f"documents/{doc_uuid}/{safe_name}"
    source_uri = await container.s3.put_object(
        storage_key, raw, content_type=file.content_type or "application/octet-stream"
    )

    text, page_count = extract_document_text(
        raw, filename=safe_name, content_type=file.content_type
    )
    extract_key = f"documents/{doc_uuid}/text.txt"
    if text:
        await container.s3.put_object(extract_key, text.encode("utf-8"), content_type="text/plain")
        extract_status = "ready"
        extract_error = None
    else:
        extract_status = "failed"
        extract_error = "Could not extract readable text from this file"

    doc = await repo.create(
        title=title,
        doc_type=doc_type,
        jurisdiction=jurisdiction,
        source_uri=source_uri,
        storage_key=storage_key,
        content_type=file.content_type,
        owner_id=owner_id,
        visibility=visibility,
        case_id=parsed_case_id,
    )
    if hasattr(doc, "id") and getattr(doc, "id", None) is None:
        doc.id = doc_uuid
    await repo.update_extraction(
        doc,
        status=extract_status,
        page_count=page_count,
        extract_key=extract_key if text else None,
        extracted_text=text,
        error=extract_error,
    )
    await session.flush()

    payload = IngestionRequestedEvent(
        document_id=doc.id,
        source_uri=source_uri,
        storage_key=storage_key,
        doc_type=doc_type,
        jurisdiction=jurisdiction,
        title=title,
        owner_id=user.user_id,
        content_type=file.content_type,
        metadata={"visibility": visibility},
    )
    if container.ingestion is not None:
        try:
            await container.ingestion.trigger(
                payload=payload,
                user_token=credentials.credentials,
            )
        except Exception as exc:
            logger.warning(
                "ingestion_trigger_failed document_id=%s error=%s",
                doc.id,
                exc,
            )

    return UploadDocumentResponse(
        document_id=str(doc.id),
        title=doc.title,
        doc_type=doc.doc_type,
        jurisdiction=doc.jurisdiction,
        visibility=doc.visibility,
        status=doc.status,
        source_uri=source_uri,
        case_id=str(doc.case_id) if doc.case_id else None,
        page_count=getattr(doc, "page_count", page_count),
        filename=safe_name,
    )


@router.get(
    "",
    response_model=Page[DocumentResponse],
    summary="List documents owned by the current user",
)
async def list_documents(
    case_id: str | None = None,
    params: PageParams = Depends(PageParams.as_query),
    user: CurrentUser = Depends(require_permissions(Permission.DOCUMENT_READ.value)),
    repo: DocumentRepository = Depends(get_document_repository),
) -> Page[DocumentResponse]:
    owner_id = uuid.UUID(user.user_id)
    parsed_case_id: uuid.UUID | None = None
    if case_id:
        try:
            parsed_case_id = uuid.UUID(case_id)
        except ValueError:
            raise ValidationFailedError("case_id must be a valid UUID")
    docs, total = await repo.list_for_owner(
        owner_id=owner_id,
        offset=params.offset,
        limit=params.size,
        case_id=parsed_case_id,
    )
    items = [_to_response(d) for d in docs]
    return paginate(items, total, params)


@router.get(
    "/case/{case_id}",
    response_model=list[DocumentResponse],
    summary="List documents for a case (owner or linked lawyer via consultation)",
)
async def list_case_documents(
    case_id: uuid.UUID,
    user: CurrentUser = Depends(require_permissions(Permission.DOCUMENT_READ.value)),
    repo: DocumentRepository = Depends(get_document_repository),
) -> list[DocumentResponse]:
    docs = await repo.list_for_case(
        case_id=case_id,
        requester_id=uuid.UUID(user.user_id),
    )
    return [_to_response(d) for d in docs]


async def _load_owned(repo: DocumentRepository, document_id: uuid.UUID, owner_id: uuid.UUID):
    doc = await repo.get_for_owner(document_id, owner_id)
    if doc is None:
        raise NotFoundError("Document not found")
    return doc


@router.get(
    "/{document_id}/text",
    response_model=DocumentTextResponse,
    summary="Return extracted text for an owned document",
)
async def get_document_text(
    document_id: uuid.UUID,
    user: CurrentUser = Depends(require_permissions(Permission.DOCUMENT_READ.value)),
    repo: DocumentRepository = Depends(get_document_repository),
) -> DocumentTextResponse:
    doc = await _load_owned(repo, document_id, uuid.UUID(user.user_id))
    text = getattr(doc, "extracted_text", "") or ""
    if not text:
        extract_key = (getattr(doc, "doc_metadata", None) or {}).get("extract_key")
        if extract_key:
            try:
                raw = await get_container().s3.get_object(extract_key)
                text = raw.decode("utf-8", errors="ignore")
            except Exception:
                text = ""
    return DocumentTextResponse(
        document_id=str(doc.id),
        title=doc.title,
        status=doc.status,
        page_count=getattr(doc, "page_count", None),
        text=text,
        filename=_filename_from_key(getattr(doc, "storage_key", None)),
    )


@router.get(
    "/{document_id}/file",
    summary="Download the original uploaded file",
)
async def get_document_file(
    document_id: uuid.UUID,
    user: CurrentUser = Depends(require_permissions(Permission.DOCUMENT_READ.value)),
    repo: DocumentRepository = Depends(get_document_repository),
) -> Response:
    doc = await _load_owned(repo, document_id, uuid.UUID(user.user_id))
    key = getattr(doc, "storage_key", None)
    if not key:
        raise NotFoundError("File is not available")
    try:
        data = await get_container().s3.get_object(key)
    except Exception as exc:
        logger.warning("document_file_read_failed document_id=%s error=%s", document_id, exc)
        raise NotFoundError("File is not available") from exc
    filename = _filename_from_key(key) or "document"
    media = doc.content_type or "application/octet-stream"
    return Response(
        content=data,
        media_type=media,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="Get a single owned document",
)
async def get_document(
    document_id: uuid.UUID,
    user: CurrentUser = Depends(require_permissions(Permission.DOCUMENT_READ.value)),
    repo: DocumentRepository = Depends(get_document_repository),
) -> DocumentResponse:
    owner_id = uuid.UUID(user.user_id)
    doc = await repo.get_for_owner(document_id, owner_id)
    if doc is None:
        raise NotFoundError("Document not found")
    return _to_response(doc)


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete an owned document",
)
async def delete_document(
    document_id: uuid.UUID,
    user: CurrentUser = Depends(require_permissions(Permission.DOCUMENT_WRITE.value)),
    repo: DocumentRepository = Depends(get_document_repository),
) -> None:
    owner_id = uuid.UUID(user.user_id)
    doc = await repo.get_for_owner(document_id, owner_id)
    if doc is None:
        raise NotFoundError("Document not found")
    await repo.soft_delete(doc)
