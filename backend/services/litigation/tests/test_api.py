from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from legalos_common.security import create_access_token


@pytest.fixture
def access_token() -> str:
    return create_access_token(
        "user-litigation",
        roles=["citizen"],
        permissions=["research:read"],
    )


@pytest_asyncio.fixture
async def client():
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health(client) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_strategy_returns_dict_shape(client, access_token) -> None:
    resp = await client.post(
        "/api/v1/litigation/strategy",
        json={
            "query": "Where should I file a recovery suit for unpaid invoices?",
            "facts": "Buyer in Delhi, seller in Mumbai, contract value Rs 15 lakh.",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert isinstance(body["forum"], str)
    assert isinstance(body["limitation_concerns"], list)
    assert isinstance(body["procedural_steps"], list)
    assert isinstance(body["required_documents"], list)
