"""Parse articles.json dict — skip articles already in constitution.json."""

from __future__ import annotations

import json
import re
from pathlib import Path

from parsers.types import ParsedChunk, ParsedDocument

_ARTICLE_TITLE_RE = re.compile(r"Article\s+(\d+[A-Za-z]?)", re.IGNORECASE)


def _article_from_title(title: str) -> str | None:
    match = _ARTICLE_TITLE_RE.search(title)
    return match.group(1) if match else None


def parse_json_articles_dict(
    path: Path,
    *,
    existing_articles: set[str] | None = None,
    doc_type: str = "constitution",
    jurisdiction: str = "india",
) -> ParsedDocument | None:
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object in {path}")

    skip = {a.lower() for a in (existing_articles or set())}
    chunks: list[ParsedChunk] = []
    skipped = 0

    for title_key, content in data.items():
        if not isinstance(content, str) or not content.strip():
            continue
        article_num = _article_from_title(title_key)
        if article_num and article_num.lower() in skip:
            skipped += 1
            continue
        chunks.append(
            ParsedChunk(
                content=content.strip(),
                title=title_key.strip(),
                section=article_num,
                citation=f"Constitution of India — {title_key.strip()}",
                metadata={
                    "article_number": article_num,
                    "source": "articles_dict",
                    "lang": "en",
                },
            )
        )

    if not chunks:
        return None

    combined = "\n".join(c.content for c in chunks)
    doc = ParsedDocument(
        title=f"Constitution articles supplement ({path.name}, skipped {skipped} duplicates)",
        doc_type=doc_type,
        jurisdiction=jurisdiction,
        chunks=chunks,
        source_file=str(path),
        content_hash=ParsedDocument.hash_content(combined),
        citations=["Constitution of India"],
    )
    doc.citations.append(f"dedup_skipped:{skipped}")
    return doc
