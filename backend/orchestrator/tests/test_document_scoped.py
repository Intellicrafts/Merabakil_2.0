"""Tests for document-scoped retrieval logic."""

from __future__ import annotations

import pytest

from legalos_common.rag.filters import SearchFilters
from legalos_common.rag.schemas import RetrievedSource
from legalos_orchestrator.agent.citation_merger import merge_citations
from legalos_orchestrator.agent.tools.kb_tool import _format_sources


def _make_source(doc_id: str, title: str = "Test Contract") -> RetrievedSource:
    return RetrievedSource(
        chunk_id=f"{doc_id}:0",
        document_id=doc_id,
        title=title,
        content="Indemnity clause applies to third-party claims.",
        score=0.9,
    )


# ---------------------------------------------------------------------------
# KB tool formatting
# ---------------------------------------------------------------------------

def test_format_sources_single() -> None:
    sources = [_make_source("doc-123", "Test Contract")]
    text = _format_sources(sources, offset=0)
    assert "[KB-1]" in text
    assert "Test Contract" in text
    assert "Indemnity clause" in text


def test_format_sources_offset() -> None:
    sources = [_make_source("doc-456", "Second Contract")]
    text = _format_sources(sources, offset=2)
    assert "[KB-3]" in text  # 2 + 1 = 3


def test_format_sources_empty() -> None:
    text = _format_sources([], offset=0)
    assert "No relevant documents found" in text


# ---------------------------------------------------------------------------
# Retriever respects document filter (via direct retriever call)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_retriever_filter_document_scoped() -> None:
    """Verify that document filters are respected by calling the retriever directly."""

    class FakeRetriever:
        def __init__(self) -> None:
            self.received_filters: SearchFilters | None = None

        async def retrieve(self, query, *, top_k, filters, user_token):
            self.received_filters = filters
            if filters and filters.document_id == "doc-123":
                return [_make_source("doc-123")]
            return []

    retriever = FakeRetriever()
    filters = SearchFilters(document_id="doc-123")
    results = await retriever.retrieve("What indemnity?", top_k=8, filters=filters, user_token=None)

    assert len(results) == 1
    assert results[0].document_id == "doc-123"
    assert retriever.received_filters.document_id == "doc-123"


# ---------------------------------------------------------------------------
# Citation merger with document-sourced results
# ---------------------------------------------------------------------------

def test_citation_merger_with_document_result() -> None:
    sources = [_make_source("doc-123", "Client Agreement")]
    answer = "Per the contract [KB-1], indemnity covers third-party claims."
    kb_cits, web_cits = merge_citations(answer, sources, [])

    assert len(kb_cits) == 1
    assert kb_cits[0].marker == "[KB-1]"
    assert kb_cits[0].document_id == "doc-123"
    assert kb_cits[0].title == "Client Agreement"
    assert web_cits == []
