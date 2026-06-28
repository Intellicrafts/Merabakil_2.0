"""HTTP clients for Phase 2 specialist microservices."""

from __future__ import annotations

from typing import Any

import httpx

from legalos_common.logging import get_logger

logger = get_logger(__name__)


class HttpSpecialistClient:
    def __init__(self, base_url: str, path: str, *, timeout: float = 60.0) -> None:
        self._url = f"{base_url.rstrip('/')}{path}"
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def analyze(
        self,
        *,
        query: str,
        facts: str | None,
        document_id: str | None,
        user_token: str | None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"query": query, "facts": facts}
        if document_id:
            payload["document_id"] = document_id
        headers = {"Authorization": f"Bearer {user_token}"} if user_token else {}
        resp = await self._get_client().post(self._url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()
