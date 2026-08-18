"""Load raw-data/ into in-memory corpus for native (no-Docker) production mode."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from corpus_sources import (
    PRIORITY_SOURCES,
    SKIP_FILES,
    RAW_DATA,
    parse_source,
    pdf_to_document,
    slug,
)
from parsers.types import ParsedDocument

# Re-export for callers that imported these names
__all__ = ["load_raw_data_corpus", "PRIORITY_SOURCES", "SKIP_FILES", "RAW_DATA"]


def _doc_to_corpus_entries(
    doc: ParsedDocument,
    doc_key: str,
    *,
    source_uri: str,
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for idx, chunk in enumerate(doc.chunks):
        cid = f"{doc_key}:{idx}"
        chunk_hash = ParsedDocument.hash_content(chunk.content)
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
                "content_hash": chunk_hash,
                "source_uri": source_uri,
                "source_content_hash": doc.content_hash,
                **{k: v for k, v in chunk.metadata.items() if k not in ("content",)},
            }
        )
    return entries


def load_raw_data_corpus(
    *,
    include_pdfs: bool = True,
    source_filter: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Parse raw-data/ and return flat corpus entries for MemVectorStore."""
    corpus: list[dict[str, Any]] = []
    wanted = set(source_filter) if source_filter else None

    for rel, kind, _doc_type in PRIORITY_SOURCES:
        if wanted is not None and rel not in wanted:
            continue
        path = RAW_DATA / rel
        if not path.is_file() or path.name in SKIP_FILES:
            continue
        if kind == "pdf" and not include_pdfs:
            continue

        try:
            doc = parse_source(rel)
        except Exception:
            if kind == "pdf":
                doc = pdf_to_document(path, _doc_type)
            else:
                raise

        if doc is None or not doc.chunks:
            continue
        doc_key = slug(Path(rel).stem)
        corpus.extend(_doc_to_corpus_entries(doc, doc_key, source_uri=rel))

    return corpus
