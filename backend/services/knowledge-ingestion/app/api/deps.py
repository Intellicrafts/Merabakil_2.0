from __future__ import annotations

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases import IngestDocumentUseCase
from app.config import get_settings
from app.infrastructure.container import get_container
from app.infrastructure.db import get_session
from app.infrastructure.repositories import DocumentRepository


def build_ingest_use_case(session: AsyncSession = Depends(get_session)) -> IngestDocumentUseCase:
    container = get_container()
    return IngestDocumentUseCase(
        documents=DocumentRepository(session),
        embedder=container.embedder,
        index=container.indexer,
        events=container.events,
        settings=get_settings(),
    )
