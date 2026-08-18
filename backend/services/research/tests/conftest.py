from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from legalos_common.rag.schemas import Citation, ConfidenceBreakdown, RetrievedSource
from legalos_common.security import create_access_token
from legalos_orchestrator.schemas import Intent, JurisdictionResult, OrchestratorResult, OrchestratorState


class MockOrchestrator:
    """Returns a fixed OrchestratorResult for testing the API layer."""

    _FIXED_SOURCES = [
        RetrievedSource(
            chunk_id="d1:0",
            document_id="d1",
            title="Indian Contract Act, 1872",
            citation="Act 9 of 1872",
            section="10",
            content="What agreements are contracts: free consent, lawful consideration...",
            score=0.91,
        )
    ]

    _FIXED_RESULT = OrchestratorResult(
        query="What makes an agreement a valid contract in India?",
        intent=Intent.LEGAL_RESEARCH,
        jurisdiction=JurisdictionResult(),
        answer="Grounded legal answer citing [KB-1].",
        sources=_FIXED_SOURCES,
        web_sources=[],
        web_images=[],
        suggestions=["What is free consent?", "What is lawful consideration?", "Is consideration mandatory?"],
        citations=[Citation(marker="[KB-1]", title="Indian Contract Act, 1872", citation="Act 9 of 1872", document_id="d1", section="10")],
        confidence=ConfidenceBreakdown(retrieval_strength=0.91, source_agreement=1.0, coverage=0.2, overall=0.67),
        trace=[],
        specialist_payload={},
    )

    async def run_state(self, state: OrchestratorState) -> OrchestratorResult:
        return self._FIXED_RESULT

    async def run_state_streaming(self, state: OrchestratorState):
        import json
        yield f"event: status\ndata: {json.dumps({'stage': 'thinking', 'message': 'Analysing…'})}\n\n"
        yield f"event: token\ndata: {json.dumps({'text': 'Grounded legal answer citing [KB-1].'})}\n\n"
        yield f"event: done\ndata: {json.dumps(self._FIXED_RESULT.model_dump(mode='json'))}\n\n"

    async def run(self, query, *, jurisdiction_hint=None, user_token=None) -> OrchestratorResult:
        return self._FIXED_RESULT


@pytest.fixture
def access_token() -> str:
    return create_access_token(
        "user-1", roles=["citizen"], permissions=["research:read"]
    )


@pytest_asyncio.fixture
async def client():
    from app.infrastructure import container as container_mod
    from app.main import app

    container = container_mod.get_container()
    container.orchestrator = MockOrchestrator()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
