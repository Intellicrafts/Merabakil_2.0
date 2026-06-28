from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from legalos_common.security import create_access_token


@pytest.fixture
def access_token() -> str:
    return create_access_token(
        str(uuid.uuid4()),
        roles=["citizen"],
        permissions=["document:read", "document:write"],
    )


class FakeDoc:
    id = uuid.uuid4()
    title = "Test Agreement"
    doc_type = "contract"
    jurisdiction = "india"
    visibility = "private"
    status = "pending"
    chunk_count = 0
    content_type = "application/pdf"
    created_at = None


@pytest_asyncio.fixture
async def client(monkeypatch):
    from app.api.deps import get_document_repository
    from app.infrastructure.db import get_session
    from app.main import app

    fake_doc = FakeDoc()
    fake_repo = MagicMock()
    fake_repo.create = AsyncMock(return_value=fake_doc)

    container_mock = MagicMock()
    container_mock.s3.put_object = AsyncMock(return_value="s3://legalos-documents/test/doc.pdf")
    container_mock.ingestion.trigger = AsyncMock()
    monkeypatch.setattr("app.api.routes.get_container", lambda: container_mock)

    async def _fake_session():
        session = MagicMock()
        session.flush = AsyncMock()
        yield session

    app.dependency_overrides[get_session] = _fake_session
    app.dependency_overrides[get_document_repository] = lambda: fake_repo

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health(client) -> None:
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_upload_requires_auth() -> None:
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        resp = await ac.post(
            "/api/v1/documents/upload",
            data={"title": "Test", "doc_type": "contract"},
            files={"file": ("test.pdf", b"pdf-content", "application/pdf")},
        )
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_upload_creates_document(client, access_token) -> None:
    resp = await client.post(
        "/api/v1/documents/upload",
        data={"title": "Test", "doc_type": "contract", "visibility": "private"},
        files={"file": ("test.pdf", b"pdf-content", "application/pdf")},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["title"] == "Test Agreement"
    assert body["visibility"] == "private"
