"""Integration tests for document-scoped research flow."""

from __future__ import annotations

import pytest

from legalos_common.rag.filters import SearchFilters
from legalos_orchestrator.agents.research import ResearchAgent
from legalos_orchestrator.schemas import OrchestratorState, ResearchScope


class FakeRetriever:
    def __init__(self) -> None:
        self.last_filters: SearchFilters | None = None

    async def retrieve(self, query, *, top_k, filters, user_token):
        self.last_filters = filters
        from legalos_common.rag.schemas import RetrievedSource

        if filters and filters.document_id == "doc-123":
            return [
                RetrievedSource(
                    chunk_id="doc-123:0",
                    document_id="doc-123",
                    title="Test Contract",
                    content="Indemnity clause applies to third-party claims.",
                    score=0.9,
                )
            ]
        return []


@pytest.mark.asyncio
async def test_research_agent_passes_document_filter() -> None:
    retriever = FakeRetriever()
    agent = ResearchAgent(retriever)
    state = OrchestratorState(
        query="What indemnity applies?",
        scope=ResearchScope.DOCUMENT,
        search_filters=SearchFilters(document_id="doc-123"),
    )
    update = await agent(state)
    assert len(update["sources"]) == 1
    assert retriever.last_filters is not None
    assert retriever.last_filters.document_id == "doc-123"


@pytest.mark.asyncio
async def test_contract_review_specialist_agent() -> None:
    from legalos_orchestrator.agents.specialists import ContractReviewAgent

    class StubService:
        async def analyze(self, *, query, facts, document_id, user_token):
            return {"risk_score": 0.7, "missing_clauses": ["indemnity"]}

    state = OrchestratorState(query="review this contract for indemnity")
    state.answer = "Sample answer"
    update = await ContractReviewAgent(StubService())(state)
    assert update["metadata"]["specialist_result"]["risk_score"] == 0.7
