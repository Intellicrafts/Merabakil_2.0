from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from legalos_common.security import create_access_token


@pytest.fixture
def access_token() -> str:
    return create_access_token(
        "user-drafting",
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
async def test_generate_legal_notice(client, access_token) -> None:
    resp = await client.post(
        "/api/v1/drafting/generate",
        json={
            "template_type": "legal_notice",
            "jurisdiction": "Maharashtra",
            "variables": {
                "recipient_name": "ABC Pvt Ltd",
                "recipient_address": "Mumbai",
                "client_name": "Mr. Sharma",
                "client_address": "Pune",
                "facts_summary": "Breach of payment terms.",
                "demand_action": "pay outstanding dues",
                "notice_period_days": "15",
                "place": "Pune",
                "date": "2026-06-28",
                "advocate_name": "Adv. Patel",
                "enrollment_no": "MAH/1234/2020",
            },
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["template_type"] == "legal_notice"
    assert len(body["draft_text"]) > 50
