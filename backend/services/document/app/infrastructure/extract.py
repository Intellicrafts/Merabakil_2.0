"""In-process text extraction for uploaded chat documents."""

from __future__ import annotations

import io
from pathlib import PurePath

from legalos_common.logging import get_logger

logger = get_logger(__name__)

EXTRACT_CHAR_CAP = 200_000

_TEXT_EXT = {".txt", ".md", ".csv", ".json"}


def extract_document_text(
    data: bytes,
    *,
    filename: str | None = None,
    content_type: str | None = None,
) -> tuple[str, int]:
    """Return (text, page_count). page_count is 1 for non-paginated formats."""
    name = (filename or "").lower()
    ctype = (content_type or "").lower()
    suffix = PurePath(name).suffix

    if suffix in _TEXT_EXT or ctype.startswith("text/") or ctype in {"application/json", "text/csv"}:
        return _decode_text(data), 1
    if suffix == ".pdf" or ctype == "application/pdf":
        return _extract_pdf(data)
    if suffix == ".docx" or ctype in {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }:
        return _extract_docx(data)
    if suffix == ".doc":
        text = _extract_docx(data)
        if text[0]:
            return text
        return _decode_text(data), 1
    return _decode_text(data), 1


def _decode_text(data: bytes) -> str:
    try:
        raw = data.decode("utf-8")
    except UnicodeDecodeError:
        raw = data.decode("latin-1", errors="ignore")
    return raw.strip()[:EXTRACT_CHAR_CAP]


def _extract_pdf(data: bytes) -> tuple[str, int]:
    try:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        pages = [(page.extract_text() or "") for page in reader.pages]
        combined = "\n\n".join(pages).strip()[:EXTRACT_CHAR_CAP]
        return combined, len(reader.pages)
    except Exception as exc:
        logger.warning("pdf_extract_failed error=%s", exc)
        fallback = _decode_text(data)
        return fallback, 1


def _extract_docx(data: bytes) -> tuple[str, int]:
    try:
        from docx import Document

        doc = Document(io.BytesIO(data))
        parts = [p.text for p in doc.paragraphs if p.text]
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                if cells:
                    parts.append(" | ".join(cells))
        return "\n".join(parts).strip()[:EXTRACT_CHAR_CAP], 1
    except Exception as exc:
        logger.warning("docx_extract_failed error=%s", exc)
        return "", 1
