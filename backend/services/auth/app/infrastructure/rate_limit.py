"""Redis fixed-window rate limiter (fails open if Redis is unavailable)."""

from __future__ import annotations

import redis.asyncio as redis

from legalos_common.logging import get_logger

logger = get_logger(__name__)


class RateLimiter:
    def __init__(self, redis_url: str, *, max_requests: int, window_seconds: int) -> None:
        self._redis = redis.from_url(redis_url, decode_responses=True)
        self._max = max_requests
        self._window = window_seconds

    async def allow(self, key: str) -> bool:
        bucket = f"ratelimit:{key}"
        try:
            current = await self._redis.incr(bucket)
            if current == 1:
                await self._redis.expire(bucket, self._window)
            return current <= self._max
        except Exception:
            logger.warning("rate_limiter_unavailable", key=key)
            return True

    async def close(self) -> None:
        await self._redis.aclose()
