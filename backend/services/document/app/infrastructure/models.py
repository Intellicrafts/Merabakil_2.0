"""ORM mapping for the documents table (shared platform schema)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from legalos_common.db import Base, TimestampMixin, UUIDMixin


class Document(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documents"
    __table_args__ = {"extend_existing": True}

    owner_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    case_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    doc_type: Mapped[str] = mapped_column(String(120), nullable=False)
    jurisdiction: Mapped[str | None] = mapped_column(String(120))
    source_uri: Mapped[str | None] = mapped_column(Text)
    storage_key: Mapped[str | None] = mapped_column(Text)
    content_type: Mapped[str | None] = mapped_column(String(120))
    page_count: Mapped[int | None] = mapped_column(Integer)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    visibility: Mapped[str] = mapped_column(String(20), default="private", nullable=False)
    doc_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, default=dict)
