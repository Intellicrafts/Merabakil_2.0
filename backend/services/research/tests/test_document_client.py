from __future__ import annotations

import pytest

from app.infrastructure.document_client import DocumentTextClient


@pytest.mark.asyncio
async def test_fetch_full_returns_title_and_text(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResp:
        status_code = 200

        def json(self) -> dict:
            return {"title": "lease.txt", "text": "Security deposit is 50000", "status": "ready"}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, _url: str, headers=None):
            return FakeResp()

    monkeypatch.setattr(
        "app.infrastructure.document_client.httpx.AsyncClient",
        lambda **_kwargs: FakeClient(),
    )
    client = DocumentTextClient("http://localhost:8005")
    title, text = await client.fetch_full("doc-1", user_token="token")
    assert title == "lease.txt"
    assert "50000" in text


@pytest.mark.asyncio
async def test_fetch_full_needs_a_token() -> None:
    client = DocumentTextClient("http://localhost:8005")
    assert await client.fetch_full("doc-1", user_token=None) is None


@pytest.mark.asyncio
async def test_fetch_full_image_placeholder(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResp:
        status_code = 200

        def json(self) -> dict:
            return {"title": "scan", "text": "", "status": "failed", "filename": "scan.jpg"}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, _url: str, headers=None):
            return FakeResp()

    monkeypatch.setattr(
        "app.infrastructure.document_client.httpx.AsyncClient",
        lambda **_kwargs: FakeClient(),
    )
    client = DocumentTextClient("http://localhost:8005")
    title, text = await client.fetch_full("doc-img", user_token="token")
    assert title == "scan"
    assert "Image uploaded" in text
