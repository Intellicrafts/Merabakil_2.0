"""Redis cache for hybrid search results."""

from __future__ import annotations

import hashlib
import json

import redis.asyncio as aioredis

from legalos_common.rag.filters import SearchFilters
from legalos_common.rag.schemas import RetrievedSource


class SearchResultCache:
    def __init__(self, redis_url: str, *, ttl_seconds: int = 600) -> None:
        self._redis = aioredis.from_url(redis_url, decode_responses=True)
        self._ttl = ttl_seconds

    def _key(self, query: str, mode: str, top_k: int, filters: SearchFilters | None) -> str:
        payload = {
            "q": query,
            "m": mode,
            "k": top_k,
            "f": filters.model_dump() if filters else {},
        }
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        return f"search:cache:{digest}"

    async def get(
        self, query: str, mode: str, top_k: int, filters: SearchFilters | None
    ) -> list[RetrievedSource] | None:
        raw = await self._redis.get(self._key(query, mode, top_k, filters))
        if not raw:
            return None
        data = json.loads(raw)
        return [RetrievedSource.model_validate(item) for item in data]

    async def set(
        self,
        query: str,
        mode: str,
        top_k: int,
        filters: SearchFilters | None,
        results: list[RetrievedSource],
    ) -> None:
        payload = json.dumps([r.model_dump() for r in results])
        await self._redis.setex(self._key(query, mode, top_k, filters), self._ttl, payload)

    async def clear_all(self) -> None:
        async for key in self._redis.scan_iter("search:cache:*"):
            await self._redis.delete(key)

    async def close(self) -> None:
        await self._redis.aclose()
