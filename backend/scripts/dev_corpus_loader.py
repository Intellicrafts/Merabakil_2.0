"""Load raw-data/ into in-memory corpus for native (no-Docker) production mode."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from parsers.csv_legal_db import parse_csv_legal_db
from parsers.json_articles_dict import parse_json_articles_dict
from parsers.json_constitution import article_numbers_from_constitution, parse_json_constitution
from parsers.types import ParsedChunk, ParsedDocument

ROOT = Path(__file__).resolve().parents[2]
RAW_DATA = ROOT / "raw-data"

SKIP_FILES = {"Indian_constitution_hindi.pdf", "Indian_constitution_english.pdf"}

PRIORITY_SOURCES: list[tuple[str, str, str]] = [
    ("Indian_law_and_supreme_cort/Indian_Law_and_Supreme_Court_Database_2026_NLPRAG.csv", "csv", "legal_database"),
    ("Indian_constitution/Indian_constitution.json", "constitution_json", "constitution"),
    ("All_articels_of_indian_constitution/articles.json", "articles_dict", "constitution"),
    ("All amendments/AMENDMENTS_2.pdf", "pdf", "constitutional_amendment"),
    ("All amendments/AMENDMENTS (1).pdf", "pdf", "constitutional_amendment"),
    ("Repealed Laws /Repealed Laws _1950_to_2014.pdf", "pdf", "repealed_statute"),
    ("Repealed Laws /Repealed_Laws1 _2014_to_2026.pdf", "pdf", "repealed_statute"),
]


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:80] or "doc"


def _pdf_to_document(path: Path, doc_type: str) -> ParsedDocument | None:
    import io
    import re

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


def _doc_to_corpus_entries(doc: ParsedDocument, doc_key: str) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for idx, chunk in enumerate(doc.chunks):
        cid = f"{doc_key}:{idx}"
        entries.append(
            {
                "id": cid,
                "chunk_id": cid,
                "document_id": doc_key,
                "title": chunk.title or doc.title,
                "doc_type": doc.doc_type,
                "jurisdiction": doc.jurisdiction,
                "citation": chunk.citation,
                "section": chunk.section,
                "content": chunk.content,
                **{k: v for k, v in chunk.metadata.items() if k not in ("content",)},
            }
        )
    return entries


def load_raw_data_corpus(*, include_pdfs: bool = True) -> list[dict[str, Any]]:
    """Parse raw-data/ and return flat corpus entries for MemVectorStore."""
    corpus: list[dict[str, Any]] = []
    constitution_path = RAW_DATA / "Indian_constitution" / "Indian_constitution.json"
    existing_articles: set[str] = set()
    if constitution_path.is_file():
        existing_articles = article_numbers_from_constitution(constitution_path)

    for rel, kind, doc_type in PRIORITY_SOURCES:
        path = RAW_DATA / rel
        if not path.is_file() or path.name in SKIP_FILES:
            continue

        doc: ParsedDocument | None = None
        if kind == "csv":
            doc = parse_csv_legal_db(path, doc_type=doc_type)
        elif kind == "constitution_json":
            doc = parse_json_constitution(path, doc_type=doc_type)
        elif kind == "articles_dict":
            doc = parse_json_articles_dict(path, existing_articles=existing_articles, doc_type=doc_type)
        elif kind == "pdf" and include_pdfs:
            doc = _pdf_to_document(path, doc_type)

        if doc is None or not doc.chunks:
            continue
        doc_key = _slug(Path(rel).stem)
        corpus.extend(_doc_to_corpus_entries(doc, doc_key))

    return corpus
