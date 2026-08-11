"""Parse NLPRAG legal database CSV — one chunk per row."""

from __future__ import annotations

import csv
from pathlib import Path

from parsers.types import ParsedChunk, ParsedDocument


def _field(row: dict[str, str], key: str) -> str:
    return (row.get(key) or "").strip()


def _build_chunk_text(row: dict[str, str]) -> str:
    parts = [
        f"Title: {_field(row, 'title')}",
        f"Article/Section: {_field(row, 'article_section')}",
        f"Source type: {_field(row, 'source_type')}",
        f"Category: {_field(row, 'category')}",
        f"Text: {_field(row, 'verbatim_text_excerpt')}",
        f"Explanation: {_field(row, 'simplified_explanation')}",
        f"Keywords: {_field(row, 'keywords')}",
    ]
    lc1 = _field(row, "landmark_case_1")
    if lc1:
        parts.append(
            f"Landmark case 1: {lc1} ({_field(row, 'lc1_year')}): {_field(row, 'lc1_holding_summary')}"
        )
    lc2 = _field(row, "landmark_case_2")
    if lc2:
        parts.append(
            f"Landmark case 2: {lc2} ({_field(row, 'lc2_year')}): {_field(row, 'lc2_holding_summary')}"
        )
    cross = _field(row, "cross_references")
    if cross:
        parts.append(f"Cross references: {cross}")
    mapping = _field(row, "current_law_mapping")
    if mapping:
        parts.append(f"Current law mapping: {mapping}")
    return "\n".join(p for p in parts if not p.endswith(": "))


def parse_csv_legal_db(
    path: Path,
    *,
    doc_type: str = "legal_database",
    jurisdiction: str = "india",
) -> ParsedDocument:
    rows: list[dict[str, str]] = []
    with path.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = list(reader)

    chunks: list[ParsedChunk] = []
    all_citations: list[str] = []
    for row in rows:
        provision_id = _field(row, "provision_id")
        article_section = _field(row, "article_section")
        title = _field(row, "title") or provision_id or "Legal provision"
        content = _build_chunk_text(row)
        if not content.strip():
            continue
        chunk_title = f"{title} ({article_section})" if article_section else title
        chunks.append(
            ParsedChunk(
                content=content,
                title=chunk_title,
                section=article_section or None,
                citation=provision_id or None,
                metadata={
                    "provision_id": provision_id,
                    "source_type": _field(row, "source_type"),
                    "category": _field(row, "category"),
                    "part_chapter": _field(row, "part_chapter"),
                    "article_section": article_section,
                    "upsc_relevance": _field(row, "upsc_relevance"),
                    "row_status": _field(row, "row_status"),
                    "lang": "en",
                },
            )
        )
        for key in ("landmark_case_1", "landmark_case_2"):
            case = _field(row, key)
            if case:
                all_citations.append(case)

    combined = "\n".join(c.content for c in chunks)
    return ParsedDocument(
        title=f"Indian Law & Supreme Court Database ({path.name})",
        doc_type=doc_type,
        jurisdiction=jurisdiction,
        chunks=chunks,
        source_file=str(path),
        content_hash=ParsedDocument.hash_content(combined),
        citations=list(dict.fromkeys(all_citations)),
    )
