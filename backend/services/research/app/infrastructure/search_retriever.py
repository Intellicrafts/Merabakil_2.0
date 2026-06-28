"""Retriever that calls the Search service over HTTP (forwarding the user token)."""

from __future__ import annotations

import httpx

from legalos_common.logging import get_logger
from legalos_common.rag.filters import SearchFilters
from legalos_common.rag.schemas import RetrievedSource

logger = get_logger(__name__)


class HttpSearchRetriever:
    def __init__(self, base_url: str, *, timeout: float = 30.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self._timeout)
        return self._client

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def retrieve(
        self,
        query: str,
        *,
        top_k: int,
        filters: SearchFilters | None,
        user_token: str | None,
    ) -> list[RetrievedSource]:
        payload: dict = {"query": query, "top_k": top_k, "mode": "hybrid"}
        if filters and not filters.is_empty():
            payload.update(filters.to_search_payload())
        headers = {"Authorization": f"Bearer {user_token}"} if user_token else {}

        try:
            resp = await self._get_client().post(
                f"{self._base_url}/api/v1/search", json=payload, headers=headers
            )
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPError:
            logger.exception("search_service_call_failed")
            return []

        return [RetrievedSource.model_validate(item) for item in data.get("results", [])]
