"""SQLite-backed document repository for native / offline mode."""

from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


def _now() -> datetime:
    return datetime.now(UTC)


@dataclass
class NativeDocument:
    id: uuid.UUID
    title: str
    doc_type: str
    jurisdiction: str | None
    visibility: str
    status: str
    chunk_count: int
    content_type: str | None
    created_at: datetime | None
    case_id: uuid.UUID | None
    owner_id: uuid.UUID | None
    source_uri: str | None = None
    storage_key: str | None = None
    page_count: int | None = None
    doc_metadata: dict[str, Any] = field(default_factory=dict)
    extracted_text: str = ""


def _row_to_doc(row: sqlite3.Row) -> NativeDocument:
    return NativeDocument(
        id=uuid.UUID(row["id"]),
        title=row["title"],
        doc_type=row["doc_type"],
        jurisdiction=row["jurisdiction"],
        visibility=row["visibility"],
        status=row["status"],
        chunk_count=row["chunk_count"] or 0,
        content_type=row["content_type"],
        created_at=datetime.fromisoformat(row["created_at"]) if row["created_at"] else None,
        case_id=uuid.UUID(row["case_id"]) if row["case_id"] else None,
        owner_id=uuid.UUID(row["owner_id"]) if row["owner_id"] else None,
        source_uri=row["source_uri"],
        storage_key=row["storage_key"],
        page_count=row["page_count"],
        doc_metadata=json.loads(row["metadata"] or "{}"),
        extracted_text=row["extracted_text"] or "",
    )


class SqliteDocumentRepository:
    def __init__(self, path: str | Path) -> None:
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY,
                    owner_id TEXT,
                    case_id TEXT,
                    title TEXT NOT NULL,
                    doc_type TEXT NOT NULL,
                    jurisdiction TEXT,
                    source_uri TEXT,
                    storage_key TEXT,
                    content_type TEXT,
                    page_count INTEGER,
                    chunk_count INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'pending',
                    visibility TEXT DEFAULT 'private',
                    metadata TEXT DEFAULT '{}',
                    extracted_text TEXT DEFAULT '',
                    created_at TEXT
                )
                """
            )
            conn.commit()

    async def create(
        self,
        *,
        title: str,
        doc_type: str,
        jurisdiction: str | None,
        source_uri: str | None,
        storage_key: str | None,
        content_type: str | None,
        owner_id: uuid.UUID,
        visibility: str,
        case_id: uuid.UUID | None = None,
    ) -> NativeDocument:
        doc = NativeDocument(
            id=uuid.uuid4(),
            title=title,
            doc_type=doc_type,
            jurisdiction=jurisdiction,
            visibility=visibility,
            status="pending",
            chunk_count=0,
            content_type=content_type,
            created_at=_now(),
            case_id=case_id,
            owner_id=owner_id,
            source_uri=source_uri,
            storage_key=storage_key,
        )
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO documents (
                    id, owner_id, case_id, title, doc_type, jurisdiction, source_uri,
                    storage_key, content_type, page_count, chunk_count, status,
                    visibility, metadata, extracted_text, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    str(doc.id),
                    str(owner_id),
                    str(case_id) if case_id else None,
                    title,
                    doc_type,
                    jurisdiction,
                    source_uri,
                    storage_key,
                    content_type,
                    None,
                    0,
                    "pending",
                    visibility,
                    "{}",
                    "",
                    doc.created_at.isoformat() if doc.created_at else None,
                ),
            )
            conn.commit()
        return doc

    async def get_for_owner(self, document_id: uuid.UUID, owner_id: uuid.UUID) -> NativeDocument | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM documents WHERE id = ? AND owner_id = ? AND status != 'deleted'",
                (str(document_id), str(owner_id)),
            ).fetchone()
        return _row_to_doc(row) if row else None

    async def list_for_owner(
        self,
        *,
        owner_id: uuid.UUID,
        offset: int,
        limit: int,
        case_id: uuid.UUID | None = None,
    ) -> tuple[list[NativeDocument], int]:
        where = "owner_id = ? AND status != 'deleted'"
        params: list[Any] = [str(owner_id)]
        if case_id is not None:
            where += " AND case_id = ?"
            params.append(str(case_id))
        with self._connect() as conn:
            total = conn.execute(f"SELECT COUNT(*) FROM documents WHERE {where}", params).fetchone()[0]
            rows = conn.execute(
                f"SELECT * FROM documents WHERE {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                [*params, limit, offset],
            ).fetchall()
        return [_row_to_doc(r) for r in rows], int(total)

    async def list_for_case(
        self,
        *,
        case_id: uuid.UUID,
        requester_id: uuid.UUID,
    ) -> list[NativeDocument]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM documents
                WHERE case_id = ? AND status != 'deleted' AND owner_id = ?
                ORDER BY created_at DESC
                """,
                (str(case_id), str(requester_id)),
            ).fetchall()
        return [_row_to_doc(r) for r in rows]

    async def soft_delete(self, doc: NativeDocument) -> None:
        doc.status = "deleted"
        with self._connect() as conn:
            conn.execute("UPDATE documents SET status = 'deleted' WHERE id = ?", (str(doc.id),))
            conn.commit()

    async def update_metadata(self, doc: NativeDocument, metadata: dict[str, Any]) -> None:
        doc.doc_metadata = {**doc.doc_metadata, **metadata}
        with self._connect() as conn:
            conn.execute(
                "UPDATE documents SET metadata = ? WHERE id = ?",
                (json.dumps(doc.doc_metadata), str(doc.id)),
            )
            conn.commit()

    async def update_extraction(
        self,
        doc: NativeDocument,
        *,
        status: str,
        page_count: int | None,
        extract_key: str | None,
        extracted_text: str,
        error: str | None = None,
    ) -> None:
        meta = {**doc.doc_metadata, "extract_key": extract_key}
        if error:
            meta["extract_error"] = error
        doc.status = status
        doc.page_count = page_count
        doc.doc_metadata = meta
        doc.extracted_text = extracted_text
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE documents
                SET status = ?, page_count = ?, metadata = ?, extracted_text = ?
                WHERE id = ?
                """,
                (status, page_count, json.dumps(meta), extracted_text, str(doc.id)),
            )
            conn.commit()
