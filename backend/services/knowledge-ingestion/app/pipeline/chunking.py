"""Recursive, overlap-aware text chunking that respects paragraph boundaries."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class Chunk:
    index: int
    text: str
    char_start: int
    char_end: int


def _split_paragraphs(text: str) -> list[str]:
    return [p.strip() for p in text.split("\n\n") if p.strip()]


def chunk_text(text: str, *, chunk_size: int = 1200, overlap: int = 200) -> list[Chunk]:
    """Greedy paragraph packing into ~chunk_size windows with character overlap.

    Paragraphs are kept whole where possible; oversized paragraphs are split on
    sentence-ish boundaries. Overlap is applied between consecutive chunks to
    preserve context for retrieval.
    """
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
            # Hard-split oversized paragraph into windows.
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
            # Carry overlap tail into the next buffer.
            tail = buffer[-overlap:] if overlap and len(buffer) > overlap else ""
            cursor += max(0, len(buffer) - len(tail))
            buffer = f"{tail}\n\n{para}" if tail else para

    flush(buffer, cursor)
    # Re-index after potential out-of-order flushing.
    for i, c in enumerate(chunks):
        c.index = i
    return chunks
