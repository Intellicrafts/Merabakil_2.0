"""Document management HTTP routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_document_repository
from app.api.schemas import DocumentResponse, UploadDocumentResponse
from app.infrastructure.container import get_container
from app.infrastructure.db import get_session
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
    if not raw:
        raise ValidationFailedError("Uploaded file is empty")

    container = get_container()
    owner_id = uuid.UUID(user.user_id)
    storage_key = f"documents/{uuid.uuid4()}/{file.filename}"
    source_uri = await container.s3.put_object(
        storage_key, raw, content_type=file.content_type or "application/octet-stream"
    )

    doc = await repo.create(
        title=title,
        doc_type=doc_type,
        jurisdiction=jurisdiction,
        source_uri=source_uri,
        storage_key=storage_key,
        content_type=file.content_type,
        owner_id=owner_id,
        visibility=visibility,
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
        await container.ingestion.trigger(
            payload=payload,
            user_token=credentials.credentials,
        )

    return UploadDocumentResponse(
        document_id=str(doc.id),
        title=doc.title,
        doc_type=doc.doc_type,
        jurisdiction=doc.jurisdiction,
        visibility=doc.visibility,
        status=doc.status,
        source_uri=source_uri,
    )


@router.get(
    "",
    response_model=Page[DocumentResponse],
    summary="List documents owned by the current user",
)
async def list_documents(
    params: PageParams = Depends(PageParams.as_query),
    user: CurrentUser = Depends(require_permissions(Permission.DOCUMENT_READ.value)),
    repo: DocumentRepository = Depends(get_document_repository),
) -> Page[DocumentResponse]:
    owner_id = uuid.UUID(user.user_id)
    docs, total = await repo.list_for_owner(
        owner_id=owner_id,
        offset=params.offset,
        limit=params.size,
    )
    items = [_to_response(d) for d in docs]
    return paginate(items, total, params)


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
