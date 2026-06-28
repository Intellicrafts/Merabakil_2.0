from __future__ import annotations

import pytest

from legalos_common.clients.llm import ChatMessage
from legalos_common.rag.schemas import RetrievedSource
from legalos_orchestrator import build_orchestrator
from legalos_orchestrator.agents.intent import IntentAgent
from legalos_orchestrator.agents.jurisdiction import JurisdictionAgent
from legalos_orchestrator.schemas import Intent, OrchestratorState


class FakeRetriever:
    def __init__(self, sources: list[RetrievedSource]) -> None:
        self._sources = sources
        self.calls: list[dict] = []

    async def retrieve(self, query, *, top_k, filters, user_token):
        self.calls.append({"query": query, "filters": filters, "user_token": user_token})
        return self._sources


class EchoLLM:
    async def complete(self, messages: list[ChatMessage], *, temperature: float = 0.1) -> str:
        ctx = next((m for m in messages if m.role == "system"), None)
        has_ctx = ctx is not None and "[1]" in ctx.content
        return "Grounded answer with citation [1]." if has_ctx else "No grounded context."


@pytest.mark.asyncio
async def test_intent_agent_detects_compliance() -> None:
    state = OrchestratorState(query="What are the GST compliance filing deadlines?")
    update = await IntentAgent()(state)
    assert update["intent"].intent == Intent.COMPLIANCE


@pytest.mark.asyncio
async def test_jurisdiction_agent_detects_high_court_and_state() -> None:
    state = OrchestratorState(query="Bombay High Court ruling relevant in Maharashtra")
    update = await JurisdictionAgent()(state)
    assert update["jurisdiction"].level == "high_court"
    assert update["jurisdiction"].region == "Maharashtra"


@pytest.mark.asyncio
async def test_full_orchestration_grounded() -> None:
    sources = [
        RetrievedSource(
            chunk_id="d1:0",
            document_id="d1",
            title="Indian Contract Act, 1872",
            citation="Act 9 of 1872",
            section="10",
            content="All agreements are contracts if made by free consent...",
            score=0.92,
        )
    ]
    retriever = FakeRetriever(sources)
    orchestrator = build_orchestrator(retriever=retriever, llm=EchoLLM())

    result = await orchestrator.run(
        "What makes an agreement a valid contract?", user_token="tok-123"
    )

    assert result.intent == Intent.LEGAL_RESEARCH
    assert result.answer == "Grounded answer with citation [1]."
    assert len(result.sources) == 1
    assert result.citations[0].marker == "[1]"
    assert 0.0 < result.confidence.overall <= 1.0
    assert "intent_agent" in result.trace
    assert "reasoning_agent" in result.trace
    assert retriever.calls[0]["user_token"] == "tok-123"


@pytest.mark.asyncio
async def test_orchestration_routes_specialist() -> None:
    retriever = FakeRetriever([])
    orchestrator = build_orchestrator(retriever=retriever, llm=EchoLLM())
    result = await orchestrator.run("Please draft a legal notice for unpaid dues")
    assert result.intent == Intent.DRAFTING
    assert "drafting_agent" in result.trace
    # No sources -> graceful, ungrounded message and zero confidence.
    assert result.confidence.overall == 0.0
