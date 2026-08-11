"""Tests for structure-aware raw-data parsers."""

from __future__ import annotations

from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
RAW = ROOT / "raw-data"

pytestmark = pytest.mark.skipif(not RAW.is_dir(), reason="raw-data folder not present")


def test_parse_csv_legal_db() -> None:
    from parsers.csv_legal_db import parse_csv_legal_db

    path = RAW / "Indian_law_and_supreme_cort" / "Indian_Law_and_Supreme_Court_Database_2026_NLPRAG.csv"
    doc = parse_csv_legal_db(path)
    assert len(doc.chunks) >= 300
    assert doc.doc_type == "legal_database"
    assert "Article 19" in doc.chunks[10].content or any("Article 19" in c.content for c in doc.chunks)


def test_parse_json_constitution() -> None:
    from parsers.json_constitution import parse_json_constitution

    path = RAW / "Indian_constitution" / "Indian_constitution.json"
    doc = parse_json_constitution(path)
    assert len(doc.chunks) >= 500
    assert any(c.metadata.get("article_number") == "Preamble" for c in doc.chunks)


def test_parse_json_articles_dict_dedupes() -> None:
    from parsers.json_articles_dict import parse_json_articles_dict
    from parsers.json_constitution import article_numbers_from_constitution

    constitution = RAW / "Indian_constitution" / "Indian_constitution.json"
    articles = RAW / "All_articels_of_indian_constitution" / "articles.json"
    existing = article_numbers_from_constitution(constitution)
    doc = parse_json_articles_dict(articles, existing_articles=existing)
    assert doc is not None
    assert len(doc.chunks) < 468
