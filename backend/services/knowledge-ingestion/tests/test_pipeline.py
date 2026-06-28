from __future__ import annotations

from app.pipeline import chunk_text, clean_text, extract_metadata


def test_clean_text_normalises_noise() -> None:
    raw = "Hello   World\r\n\r\n\r\n\r\nFoot-\nnote\n12\n"
    cleaned = clean_text(raw)
    assert "Footnote" in cleaned
    assert "   " not in cleaned
    assert "\n\n\n" not in cleaned


def test_chunking_respects_size_and_overlap() -> None:
    text = "\n\n".join(f"Paragraph number {i} with some legal content." for i in range(50))
    chunks = chunk_text(text, chunk_size=200, overlap=40)
    assert len(chunks) > 1
    assert all(len(c.text) <= 240 for c in chunks)
    assert [c.index for c in chunks] == list(range(len(chunks)))


def test_chunking_handles_oversized_paragraph() -> None:
    text = "x" * 5000
    chunks = chunk_text(text, chunk_size=1000, overlap=100)
    assert len(chunks) >= 5


def test_metadata_extracts_citations_and_sections() -> None:
    text = (
        "In Kesavananda Bharati, reported as AIR 1973 SC 1461 and (1973) 4 SCC 225, "
        "the Supreme Court interpreted Article 368. See also Section 420 of the "
        "Indian Penal Code, 1860."
    )
    meta = extract_metadata(text)
    assert any("AIR 1973 SC 1461" in c for c in meta.citations)
    assert "368" in meta.articles
    assert "420" in meta.sections
    assert meta.detected_jurisdiction == "supreme_court"
