"""Tests for the tool-calling orchestrator — citation merger, conversation helpers."""

from __future__ import annotations

import pytest

from legalos_common.config.settings import LLMSettings
from legalos_common.rag.schemas import RetrievedSource, WebSearchResult
from legalos_orchestrator.agent.citation_merger import merge_citations


# ---------------------------------------------------------------------------
# Citation merger
# ---------------------------------------------------------------------------

def _make_source(doc_id: str, title: str) -> RetrievedSource:
    return RetrievedSource(
        chunk_id=f"{doc_id}:0",
        document_id=doc_id,
        title=title,
        citation="Act 1 of 1872",
        section="10",
        content="Sample legal content.",
        score=0.9,
    )


def test_merge_citations_kb_markers() -> None:
    sources = [_make_source("d1", "Contract Act"), _make_source("d2", "Evidence Act")]
    answer = "Consent is required [KB-1]. Admissibility governed by [KB-2]."
    kb_citations, web_citations = merge_citations(answer, sources, [])

    assert len(kb_citations) == 2
    assert kb_citations[0].marker == "[KB-1]"
    assert kb_citations[0].document_id == "d1"
    assert kb_citations[1].marker == "[KB-2]"
    assert web_citations == []


def test_merge_citations_dedup() -> None:
    sources = [_make_source("d1", "Contract Act")]
    answer = "See [KB-1] and also [KB-1] for more."
    kb_citations, _ = merge_citations(answer, sources, [])
    assert len(kb_citations) == 1


def test_merge_citations_out_of_range() -> None:
    sources = [_make_source("d1", "Contract Act")]
    answer = "Reference [KB-1] and [KB-9] (non-existent)."
    kb_citations, _ = merge_citations(answer, sources, [])
    assert len(kb_citations) == 1
    assert kb_citations[0].marker == "[KB-1]"


def test_merge_citations_no_markers() -> None:
    sources = [_make_source("d1", "Contract Act")]
    answer = "Here is an answer with no citation markers."
    kb_citations, web_citations = merge_citations(answer, sources, [])
    assert kb_citations == []
    assert web_citations == []


def test_merge_citations_web_markers() -> None:
    web = [WebSearchResult(title="SC Judgment", url="https://example.com", snippet="ruling")]
    answer = "Recent judgment: [WEB-1]."
    kb_cits, web_cits = merge_citations(answer, [], web)
    assert kb_cits == []
    assert len(web_cits) == 1
    assert web_cits[0].url == "https://example.com"


# ---------------------------------------------------------------------------
# Smoke: build_orchestrator instantiates without error
# ---------------------------------------------------------------------------

def test_build_orchestrator_smoke() -> None:
    from unittest.mock import MagicMock, patch

    from legalos_orchestrator import build_orchestrator

    class FakeRetriever:
        async def retrieve(self, query, *, top_k, filters, user_token):
            return []

    llm_settings = LLMSettings(llm_model="gemini-test", llm_fast_model="gemini-test-fast", llm_api_key="k")
    with patch("legalos_orchestrator.agent.graph.ChatGoogleGenerativeAI") as mock_llm:
        mock_llm.return_value = MagicMock()
        orchestrator = build_orchestrator(retriever=FakeRetriever(), llm_settings=llm_settings, llm=None)
    assert orchestrator is not None
    # primary + fast model, each bound once per tool profile
    assert mock_llm.call_count == 2
