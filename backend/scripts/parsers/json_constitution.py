"""Parse Indian_constitution.json — one chunk per article."""

from __future__ import annotations

import json
import re
from pathlib import Path

from parsers.types import ParsedChunk, ParsedDocument

_ARTICLE_NUM_RE = re.compile(r"(\d+[A-Za-z]?)")


def _normalize_article_number(value: str | None) -> str | None:
    if not value:
        return None
    text = str(value).strip()
    if text.lower() == "preamble":
        return "Preamble"
    match = _ARTICLE_NUM_RE.search(text)
    return match.group(1) if match else text


def parse_json_constitution(
    path: Path,
    *,
    doc_type: str = "constitution",
    jurisdiction: str = "india",
) -> ParsedDocument:
    with path.open(encoding="utf-8") as fh:
        articles = json.load(fh)
    if not isinstance(articles, list):
        raise ValueError(f"Expected JSON array in {path}")

    chunks: list[ParsedChunk] = []
    for entry in articles:
        if not isinstance(entry, dict):
            continue
        article_number = _normalize_article_number(entry.get("article_number"))
        content = (entry.get("content") or "").strip()
        if not content:
            continue
        doc_type_field = entry.get("document_type") or "article"
        title = f"Article {article_number}" if article_number else "Constitution provision"
        if article_number == "Preamble":
            title = "Preamble of India"

        amendment_notes = entry.get("amendment_notes") or {}
        note_lines = [f"Amendment note {k}: {v}" for k, v in amendment_notes.items()]
        full_content = content
        if note_lines:
            full_content += "\n\nAmendment notes:\n" + "\n".join(note_lines)

        chunks.append(
            ParsedChunk(
                content=full_content,
                title=title,
                section=article_number,
                citation=f"Constitution of India — {title}",
                metadata={
                    "article_number": article_number,
                    "document_type": doc_type_field,
                    "start_page": entry.get("start_page"),
                    "schedule_number": entry.get("schedule_number"),
                    "lang": "en",
                },
            )
        )

    combined = "\n".join(c.content for c in chunks)
    return ParsedDocument(
        title="Constitution of India (structured JSON)",
        doc_type=doc_type,
        jurisdiction=jurisdiction,
        chunks=chunks,
        source_file=str(path),
        content_hash=ParsedDocument.hash_content(combined),
        citations=["Constitution of India"],
    )


def article_numbers_from_constitution(path: Path) -> set[str]:
    """Return normalized article numbers for deduplication."""
    with path.open(encoding="utf-8") as fh:
        articles = json.load(fh)
    numbers: set[str] = set()
    if not isinstance(articles, list):
        return numbers
    for entry in articles:
        if isinstance(entry, dict):
            num = _normalize_article_number(entry.get("article_number"))
            if num:
                numbers.add(num.lower())
    return numbers
