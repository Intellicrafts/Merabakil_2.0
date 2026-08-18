"""Tests for the tool-calling orchestrator — citation merger, conversation helpers."""

from __future__ import annotations

import pytest

from legalos_common.clients.llm import ChatMessage
from legalos_common.config.settings import LLMSettings
from legalos_common.rag.schemas import RetrievedSource, WebSearchResult
from legalos_orchestrator.agent.citation_merger import merge_citations
from legalos_orchestrator.conversation import is_conversational, expand_retrieval_query
from legalos_orchestrator.schemas import ConversationMessage, OrchestratorState


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
# Conversation helpers
# ---------------------------------------------------------------------------

def test_is_conversational_greeting() -> None:
    assert is_conversational("hi") is True
    assert is_conversational("Hello!") is True
    assert is_conversational("thanks") is True
    assert is_conversational("namaste") is True


def test_is_conversational_legal_query() -> None:
    assert is_conversational("What is Article 21 of the Constitution?") is False
    assert is_conversational("Explain GST compliance filing deadlines.") is False


def test_expand_retrieval_no_history() -> None:
    query = expand_retrieval_query("What is Article 21?", [])
    assert query == "What is Article 21?"


def test_expand_retrieval_with_followup() -> None:
    history = [
        ConversationMessage(role="user", content="Explain Article 21"),
        ConversationMessage(role="assistant", content="Article 21 guarantees right to life..."),
    ]
    # "Tell me more" is short (3 words) → should expand with history
    query = expand_retrieval_query("Tell me more", history)
    assert "Tell me more" in query
    assert "Article 21" in query


# ---------------------------------------------------------------------------
# Smoke: build_orchestrator instantiates without error
# ---------------------------------------------------------------------------

def test_build_orchestrator_smoke() -> None:
    pytest.importorskip("langchain_openai", reason="langchain_openai not installed in this env")

    from unittest.mock import MagicMock, patch
    from legalos_orchestrator import build_orchestrator

    class FakeRetriever:
        async def retrieve(self, query, *, top_k, filters, user_token):
            return []

    class FakeLLM:
        async def complete(self, messages, *, temperature=0.1):
            return "OK"

    llm_settings = LLMSettings(
        llm_model="gpt-4o-mini",
        llm_api_key="sk-stub",
        llm_base_url="http://localhost:9999/v1",
        llm_use_stub=True,
    )

    with patch("legalos_orchestrator.agent.graph.ChatOpenAI") as mock_openai:
        mock_openai.return_value = MagicMock()
        mock_openai.return_value.bind_tools.return_value = MagicMock()
        orchestrator = build_orchestrator(
            retriever=FakeRetriever(),
            llm_settings=llm_settings,
            llm=FakeLLM(),
        )
    assert orchestrator is not None
