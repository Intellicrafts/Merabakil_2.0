"""Text chunking: flat paragraph-based and parent-child hierarchical strategies."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(slots=True)
class Chunk:
    index: int
    text: str
    char_start: int
    char_end: int


@dataclass(slots=True)
class ParentChunk:
    parent_id: str
    content: str  # ~parent_size chars — full context for the LLM


@dataclass(slots=True)
class ChildChunk:
    child_id: str
    parent_id: str
    content: str  # ~child_size chars — the precise excerpt searched
    text_for_embedding: str  # augmented: title + section + content for better embedding


# ---------------------------------------------------------------------------
# Flat chunking (kept for structured ingestion & backward compat)
# ---------------------------------------------------------------------------

def _split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in text.split("\n\n") if p.strip()]


def chunk_text(text: str, *, chunk_size: int = 1200, overlap: int = 200) -> list[Chunk]:
    """Greedy paragraph packing into ~chunk_size windows with character overlap."""
    if not text:
        return []
    if overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    paragraphs = _split_paragraphs(text)
    if not paragraphs:
        paragraphs = [text.strip()]

    chunks: list[Chunk] = []
    buffer = ""
    cursor = 0

    def flush(buf: str, start: int) -> None:
        if buf.strip():
            chunks.append(
                Chunk(
                    index=len(chunks),
                    text=buf.strip(),
                    char_start=start,
                    char_end=start + len(buf),
                )
            )

    for para in paragraphs:
        if len(para) > chunk_size:
            flush(buffer, cursor)
            cursor += len(buffer)
            buffer = ""
            step = chunk_size - overlap
            for i in range(0, len(para), step):
                window = para[i : i + chunk_size]
                flush(window, cursor + i)
            cursor += len(para)
            continue

        candidate = f"{buffer}\n\n{para}" if buffer else para
        if len(candidate) <= chunk_size:
            buffer = candidate
        else:
            flush(buffer, cursor)
            tail = buffer[-overlap:] if overlap and len(buffer) > overlap else ""
            cursor += max(0, len(buffer) - len(tail))
            buffer = f"{tail}\n\n{para}" if tail else para

    flush(buffer, cursor)
    for i, c in enumerate(chunks):
        c.index = i
    return chunks


# ---------------------------------------------------------------------------
# Parent-child chunking (matches shared 'Converstation Chat Bot' codebase)
# ---------------------------------------------------------------------------

_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


def _split_sentences(text: str) -> list[str]:
    parts = _SENTENCE_RE.split(text.strip())
    return [p for p in parts if p.strip()]


def _build_segments(sentences: list[str], target_size: int, overlap: int) -> list[str]:
    """Greedy sentence accumulation into segments of ~target_size chars."""
    if not sentences:
        return []
    segments: list[str] = []
    current: list[str] = []
    current_len = 0

    for sent in sentences:
        sent_len = len(sent)
        if current_len + sent_len > target_size and current:
            segments.append(" ".join(current))
            # Carry overlapping tail sentences into the next segment
            overlap_parts: list[str] = []
            overlap_len = 0
            for part in reversed(current):
                if overlap_len + len(part) <= overlap:
                    overlap_parts.insert(0, part)
                    overlap_len += len(part)
                else:
                    break
            current = overlap_parts
            current_len = overlap_len
        current.append(sent)
        current_len += sent_len

    if current:
        segments.append(" ".join(current))
    return segments


def parent_child_split(
    text: str,
    doc_id: str,
    *,
    title: str = "",
    section: str = "",
    parent_size: int = 1024,
    child_size: int = 256,
    child_overlap: int = 32,
) -> list[tuple[ParentChunk, list[ChildChunk]]]:
    """Split text into (parent, [children]) pairs.

    Parents (~parent_size chars) provide full context for the LLM.
    Children (~child_size chars) are the small excerpts that are embedded and searched.
    children[i].text_for_embedding prepends title + section for richer semantic signal.
    """
    sentences = _split_sentences(text)
    parent_segments = _build_segments(sentences, parent_size, overlap=0)
    if not parent_segments:
        parent_segments = [text.strip()]

    pairs: list[tuple[ParentChunk, list[ChildChunk]]] = []

    for p_idx, parent_text in enumerate(parent_segments):
        parent_id = f"{doc_id}_parent_{p_idx}"
        parent = ParentChunk(parent_id=parent_id, content=parent_text)

        child_sentences = _split_sentences(parent_text)
        child_segments = _build_segments(child_sentences, child_size, child_overlap)
        if not child_segments:
            child_segments = [parent_text]

        children: list[ChildChunk] = []
        for c_idx, child_text in enumerate(child_segments):
            child_id = f"{doc_id}_child_{p_idx}_{c_idx}"
            text_for_embedding = " ".join(
                filter(None, [title, section, child_text])
            )
            children.append(
                ChildChunk(
                    child_id=child_id,
                    parent_id=parent_id,
                    content=child_text,
                    text_for_embedding=text_for_embedding,
                )
            )
        pairs.append((parent, children))

    return pairs
