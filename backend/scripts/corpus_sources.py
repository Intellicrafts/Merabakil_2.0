"""Shared raw-data source registry and parsers for corpus ingest."""

from __future__ import annotations

import io
import re
from pathlib import Path

from parsers.csv_legal_db import parse_csv_legal_db
from parsers.json_articles_dict import parse_json_articles_dict
from parsers.json_constitution import article_numbers_from_constitution, parse_json_constitution
from parsers.types import ParsedChunk, ParsedDocument

ROOT = Path(__file__).resolve().parents[2]
RAW_DATA = ROOT / "raw-data"

SKIP_FILES = {"Indian_constitution_hindi.pdf", "Indian_constitution_english.pdf"}

# rel_path, parser_kind, doc_type
PRIORITY_SOURCES: list[tuple[str, str, str]] = [
    ("Indian_law_and_supreme_cort/Indian_Law_and_Supreme_Court_Database_2026_NLPRAG.csv", "csv", "legal_database"),
    ("Indian_constitution/Indian_constitution.json", "constitution_json", "constitution"),
    ("All_articels_of_indian_constitution/articles.json", "articles_dict", "constitution"),
    ("All amendments/AMENDMENTS_2.pdf", "pdf", "constitutional_amendment"),
    ("All amendments/AMENDMENTS (1).pdf", "pdf", "constitutional_amendment"),
    ("Repealed Laws /Repealed Laws _1950_to_2014.pdf", "pdf", "repealed_statute"),
    ("Repealed Laws /Repealed_Laws1 _2014_to_2026.pdf", "pdf", "repealed_statute"),
]

CHUNK_SCHEMA_VERSION = "1500-100-v1"


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80] or "doc"


def pdf_to_document(path: Path, doc_type: str) -> ParsedDocument | None:
    from pypdf import PdfReader

    raw = path.read_bytes()
    reader = PdfReader(io.BytesIO(raw))
    text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    cleaned = re.sub(r"\s+\n", "\n", re.sub(r"[ \t]+", " ", text)).strip()
    if not cleaned:
        return None

    chunk_size, overlap = 1500, 100
    step = chunk_size - overlap
    chunks_raw = [cleaned[i : i + chunk_size] for i in range(0, len(cleaned), step)]
    chunks = [
        ParsedChunk(
            content=c,
            title=f"{path.stem} (part {i + 1})",
            metadata={"lang": "en", "source_file": str(path), "chunk_index": i},
        )
        for i, c in enumerate(chunks_raw)
        if c.strip()
    ]
    return ParsedDocument(
        title=path.stem.replace("_", " "),
        doc_type=doc_type,
        jurisdiction="india",
        chunks=chunks,
        source_file=str(path),
        content_hash=ParsedDocument.hash_content("".join(c.content for c in chunks)),
        page_count=len(reader.pages),
    )


def parse_source(rel: str, *, constitution_path: Path | None = None) -> ParsedDocument | None:
    """Parse one raw-data relative path. Returns None if missing/skipped."""
    entry = next((s for s in PRIORITY_SOURCES if s[0] == rel), None)
    if entry is None:
        raise ValueError(f"Unknown corpus source: {rel}")
    rel_path, kind, doc_type = entry
    path = RAW_DATA / rel_path
    if not path.is_file() or path.name in SKIP_FILES:
        return None

    if kind == "csv":
        return parse_csv_legal_db(path, doc_type=doc_type)
    if kind == "constitution_json":
        return parse_json_constitution(path, doc_type=doc_type)
    if kind == "articles_dict":
        cp = constitution_path or RAW_DATA / "Indian_constitution" / "Indian_constitution.json"
        existing = article_numbers_from_constitution(cp) if cp.is_file() else set()
        return parse_json_articles_dict(path, existing_articles=existing, doc_type=doc_type)
    if kind == "pdf":
        return pdf_to_document(path, doc_type)
    raise ValueError(f"Unknown parser kind: {kind}")


def list_sources(filter_paths: list[str] | None = None) -> list[tuple[str, str, str]]:
    if not filter_paths:
        return list(PRIORITY_SOURCES)
    wanted = set(filter_paths)
    return [s for s in PRIORITY_SOURCES if s[0] in wanted]
