"""Redis-backed session memory with TTL and automatic compression."""

from __future__ import annotations

import json
import logging
from datetime import datetime

from legalos_common.rag.memory_schemas import SessionTurn

logger = logging.getLogger(__name__)

_KEY = "research:session:{}:history"


class SessionMemory:
    def __init__(
        self,
        redis_client,
        *,
        ttl: int = 7200,
        max_turns: int = 10,
        summarizer=None,
    ) -> None:
        self._redis = redis_client
        self._ttl = ttl
        self._max_turns = max_turns
        self._summarizer = summarizer
        self._fallback: dict[str, list[str]] = {}

    async def get_history(self, session_id: str) -> list[SessionTurn]:
        if not session_id:
            return []
        key = _KEY.format(session_id)
        raw: list = []
        if self._redis:
            try:
                raw = await self._redis.lrange(key, 0, -1)
            except Exception as exc:
                logger.warning("redis_get_history_failed session=%s error=%s", session_id, exc)
                raw = self._fallback.get(key, [])
        else:
            raw = self._fallback.get(key, [])

        turns: list[SessionTurn] = []
        for item in raw:
            try:
                data = json.loads(item if isinstance(item, str) else item.decode())
                turns.append(SessionTurn(**data))
            except Exception:
                continue
        return turns

    async def append_turn(self, session_id: str, turn: SessionTurn) -> None:
        if not session_id:
            return
        key = _KEY.format(session_id)
        serialized = turn.model_dump_json()

        if self._redis:
            try:
                await self._redis.rpush(key, serialized)
                await self._redis.expire(key, self._ttl)
                length = await self._redis.llen(key)
                if length > self._max_turns * 2 and self._summarizer:
                    await self._compress(session_id)
            except Exception as exc:
                logger.warning("redis_append_turn_failed session=%s error=%s", session_id, exc)
                self._fallback.setdefault(key, []).append(serialized)
        else:
            self._fallback.setdefault(key, []).append(serialized)

    async def clear(self, session_id: str) -> None:
        key = _KEY.format(session_id)
        if self._redis:
            try:
                await self._redis.delete(key)
            except Exception as exc:
                logger.warning("redis_clear_failed session=%s error=%s", session_id, exc)
        self._fallback.pop(key, None)

    async def _compress(self, session_id: str) -> None:
        turns = await self.get_history(session_id)
        if len(turns) <= self._max_turns:
            return
        old_turns = turns[: len(turns) - self._max_turns]
        try:
            summary_text = await self._summarizer.summarize_turns(old_turns)
            summary_turn = SessionTurn(
                role="assistant",
                content=f"[Summary of earlier conversation]: {summary_text}",
                timestamp=datetime.utcnow(),
            )
            recent = turns[len(turns) - self._max_turns :]
            new_items = [summary_turn.model_dump_json()] + [t.model_dump_json() for t in recent]
            key = _KEY.format(session_id)
            if self._redis:
                pipe = self._redis.pipeline()
                pipe.delete(key)
                for item in new_items:
                    pipe.rpush(key, item)
                pipe.expire(key, self._ttl)
                await pipe.execute()
        except Exception as exc:
            logger.warning("session_compression_failed session=%s error=%s", session_id, exc)
