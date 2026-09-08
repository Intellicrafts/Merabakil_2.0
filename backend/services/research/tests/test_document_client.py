from __future__ import annotations

import pytest

from app.infrastructure.document_client import DocumentTextClient


@pytest.mark.asyncio
async def test_fetch_excerpts_formats_user_files(monkeypatch: pytest.MonkeyPatch) -> None:
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
    text = await client.fetch_excerpts(["doc-1"], user_token="token")
    assert "lease.txt" in text
    assert "50000" in text
    assert "USER-UPLOADED" in text


@pytest.mark.asyncio
async def test_fetch_excerpts_empty_without_token() -> None:
    client = DocumentTextClient("http://localhost:8005")
    assert await client.fetch_excerpts(["doc-1"], user_token=None) == ""
