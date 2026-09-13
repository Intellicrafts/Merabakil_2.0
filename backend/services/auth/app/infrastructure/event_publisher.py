"""Publishes domain events to Redis Streams (fire-and-forget)."""
from __future__ import annotations

import logging

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

_USER_STREAM = "legalos:events:user"


class EventPublisher:
    def __init__(self, redis_url: str) -> None:
        self._redis = aioredis.from_url(redis_url, decode_responses=True)

    async def publish_user_registered(self, *, user_id: str, role: str) -> None:
        """Append a user.registered event to the user stream. Never raises."""
        try:
            await self._redis.xadd(
                _USER_STREAM,
                {"event_type": "user.registered", "user_id": user_id, "role": role},
                maxlen=50_000,
                approximate=True,
            )
            logger.info("event_published event=user.registered user_id=%s", user_id)
        except Exception as exc:
            logger.warning("event_publish_failed user_id=%s error=%s", user_id, exc)

    async def close(self) -> None:
        await self._redis.aclose()
