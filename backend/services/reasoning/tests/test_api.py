from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from legalos_common.security import create_access_token


@pytest.fixture
def access_token() -> str:
    return create_access_token(
        "user-reasoning",
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
async def test_analyze_returns_risk_assessment(client, access_token) -> None:
    resp = await client.post(
        "/api/v1/reasoning/analyze",
        json={
            "query": "Can I recover unpaid rent under a lease?",
            "facts": "Tenant defaulted for 3 months; registered lease exists.",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "issues" in body
    assert 0.0 <= body["strength_score"] <= 1.0
    assert isinstance(body["missing_facts"], list)
    assert isinstance(body["recommended_next_steps"], list)
