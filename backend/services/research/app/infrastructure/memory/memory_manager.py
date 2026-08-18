"""Coordinates session memory (Redis) and long-term memory (Qdrant)."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from legalos_common.rag.memory_schemas import MemoryContext, SessionTurn

logger = logging.getLogger(__name__)


class MemoryManager:
    def __init__(self, session_memory, long_term_memory, summarizer) -> None:
        self._session = session_memory
        self._ltm = long_term_memory
        self._summarizer = summarizer

    async def retrieve(
        self,
        session_id: str | None,
        user_id: str | None,
        query: str,
    ) -> MemoryContext:
        """Retrieve session history and long-term facts concurrently."""
        session_task = asyncio.create_task(
            self._session.get_history(session_id or "")
        )
        ltm_task = asyncio.create_task(
            self._ltm.retrieve_relevant(user_id or "", query)
        )
        history, facts = await asyncio.gather(session_task, ltm_task)
        return MemoryContext(session_history=history, long_term_facts=facts)

    async def persist(
        self,
        session_id: str | None,
        user_id: str | None,
        user_content: str,
        assistant_content: str,
        cited_chunk_ids: list[str] | None = None,
    ) -> None:
        """Save turns to session memory and extract long-term facts in background."""
        user_turn = SessionTurn(role="user", content=user_content, timestamp=datetime.utcnow())
        assistant_turn = SessionTurn(
            role="assistant",
            content=assistant_content,
            timestamp=datetime.utcnow(),
            cited_chunk_ids=cited_chunk_ids or [],
        )

        if session_id:
            await self._session.append_turn(session_id, user_turn)
            await self._session.append_turn(session_id, assistant_turn)

        if user_id:
            try:
                facts = await self._summarizer.extract_long_term_facts([user_turn, assistant_turn])
                for fact in facts:
                    await self._ltm.store_fact(
                        user_id=user_id,
                        fact=fact,
                        session_id=session_id or "",
                    )
            except Exception as exc:
                logger.warning("ltm_persist_failed user=%s error=%s", user_id, exc)
