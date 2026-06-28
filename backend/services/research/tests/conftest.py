from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from legalos_common.clients.llm import ChatMessage
from legalos_common.rag.schemas import RetrievedSource
from legalos_common.security import create_access_token
from legalos_orchestrator import build_orchestrator


class FakeRetriever:
    def __init__(self, sources: list[RetrievedSource]) -> None:
        self._sources = sources

    async def retrieve(self, query, *, top_k, filters, user_token):
        return self._sources


class StubLLM:
    async def complete(self, messages: list[ChatMessage], *, temperature: float = 0.1) -> str:
        return "Grounded legal answer citing [1]."


@pytest.fixture
def access_token() -> str:
    return create_access_token(
        "user-1", roles=["citizen"], permissions=["research:read"]
    )


@pytest_asyncio.fixture
async def client():
    from app.infrastructure import container as container_mod
    from app.main import app

    sources = [
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
    container = container_mod.get_container()
    container.orchestrator = build_orchestrator(
        retriever=FakeRetriever(sources), llm=StubLLM()
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
