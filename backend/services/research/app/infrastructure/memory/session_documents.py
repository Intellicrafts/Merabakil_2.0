"""Redis-backed per-session document registry.

Tracks which user-uploaded documents are "in context" for a Saarthi session.
Each session maps to a Redis SET of document_id strings.
"""

from __future__ import annotations

from legalos_common.logging import get_logger

logger = get_logger(__name__)

_KEY = "research:session:{session_id}:docs"
_TTL = 7200  # match session memory TTL


class SessionDocuments:
    def __init__(self, redis) -> None:
        self._redis = redis

    async def attach(self, session_id: str, document_id: str) -> None:
        if not self._redis or not session_id:
            return
        key = _KEY.format(session_id=session_id)
        try:
            await self._redis.sadd(key, document_id)
            await self._redis.expire(key, _TTL)
        except Exception as exc:
            logger.warning("session_docs_attach_failed session=%s error=%s", session_id, exc)

    async def get(self, session_id: str) -> list[str]:
        if not self._redis or not session_id:
            return []
        key = _KEY.format(session_id=session_id)
        try:
            members = await self._redis.smembers(key)
            return [m.decode() if isinstance(m, bytes) else str(m) for m in members]
        except Exception as exc:
            logger.warning("session_docs_get_failed session=%s error=%s", session_id, exc)
            return []

    async def remove(self, session_id: str, document_id: str) -> None:
        if not self._redis or not session_id:
            return
        key = _KEY.format(session_id=session_id)
        try:
            await self._redis.srem(key, document_id)
        except Exception as exc:
            logger.warning("session_docs_remove_failed session=%s error=%s", session_id, exc)
