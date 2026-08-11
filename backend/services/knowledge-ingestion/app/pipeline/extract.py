"""Text extraction from raw document bytes (PDF, text) with optional OCR."""

from __future__ import annotations

import io

from legalos_common.logging import get_logger

logger = get_logger(__name__)


def _extract_pdf(data: bytes, *, enable_ocr: bool) -> tuple[str, int]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(text)
    combined = "\n\n".join(pages).strip()

    if not combined and enable_ocr:
        combined = _ocr_pdf(data)
    return combined, len(reader.pages)


def _ocr_pdf(data: bytes) -> str:
    """OCR fallback for scanned PDFs. Requires pdf2image + pytesseract + tesseract."""
    try:
        import pytesseract
        from pdf2image import convert_from_bytes

        images = convert_from_bytes(data)
        return "\n\n".join(pytesseract.image_to_string(img) for img in images).strip()
    except Exception:
        logger.warning("ocr_unavailable_or_failed")
        return ""


def extract_text(
    data: bytes,
    *,
    content_type: str | None = None,
    filename: str | None = None,
    enable_ocr: bool = False,
) -> tuple[str, int]:
    """Return (text, page_count). page_count is 1 for non-paginated formats."""
    name = (filename or "").lower()
    ctype = (content_type or "").lower()

    if name.endswith(".json") or ctype == "application/json":
        return data.decode("utf-8", errors="ignore"), 1
    if name.endswith(".csv") or ctype == "text/csv":
        return data.decode("utf-8", errors="ignore"), 1

    is_pdf = ctype == "application/pdf" or name.endswith(".pdf")
    if is_pdf:
        return _extract_pdf(data, enable_ocr=enable_ocr)
    # Fallback: best-effort UTF-8 / latin-1 decode for text-like inputs.
    try:
        return data.decode("utf-8"), 1
    except UnicodeDecodeError:
        return data.decode("latin-1", errors="ignore"), 1
