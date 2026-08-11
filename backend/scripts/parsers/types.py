"""Shared types for structure-aware ingestion parsers."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ParsedChunk:
    content: str
    title: str
    section: str | None = None
    citation: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ParsedDocument:
    title: str
    doc_type: str
    jurisdiction: str
    chunks: list[ParsedChunk]
    source_file: str
    content_hash: str
    page_count: int | None = None
    citations: list[str] = field(default_factory=list)

    @staticmethod
    def hash_content(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()
