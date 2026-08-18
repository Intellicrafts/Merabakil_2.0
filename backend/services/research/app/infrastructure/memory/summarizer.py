"""LLM-based conversation summarizer and long-term fact extractor."""

from __future__ import annotations

import json
import logging

from legalos_common.rag.memory_schemas import SessionTurn

logger = logging.getLogger(__name__)

_SUMMARY_PROMPT = (
    "Summarize the following legal conversation turns in 1-2 sentences, "
    "preserving key legal topics, statutes, and case references discussed:\n\n{turns}"
)

_FACTS_PROMPT = (
    "Extract any persistent user preferences, professional background, legal domain specialization, "
    "or recurring facts from this conversation that would be useful to remember for future sessions. "
    "Return a JSON list of short fact strings. Return [] if nothing notable.\n\n{turns}"
)


class ConversationSummarizer:
    def __init__(self, llm_client) -> None:
        self._llm = llm_client

    async def summarize_turns(self, turns: list[SessionTurn]) -> str:
        text = "\n".join(f"{t.role.upper()}: {t.content}" for t in turns)
        from legalos_common.clients.llm import ChatMessage
        try:
            resp = await self._llm.complete(
                [ChatMessage(role="user", content=_SUMMARY_PROMPT.format(turns=text))],
                temperature=0.3,
            )
            return resp.strip()
        except Exception as exc:
            logger.warning("summarize_turns_failed error=%s", exc)
            return "(summary unavailable)"

    async def extract_long_term_facts(self, turns: list[SessionTurn]) -> list[str]:
        text = "\n".join(f"{t.role.upper()}: {t.content}" for t in turns)
        from legalos_common.clients.llm import ChatMessage
        try:
            resp = await self._llm.complete(
                [ChatMessage(role="user", content=_FACTS_PROMPT.format(turns=text))],
                temperature=0.2,
            )
            resp = resp.strip()
            if resp.startswith("```"):
                parts = resp.split("```")
                resp = parts[1].lstrip("json").strip() if len(parts) > 1 else "[]"
            facts = json.loads(resp)
            return [f for f in facts if isinstance(f, str) and f.strip()]
        except Exception as exc:
            logger.warning("extract_facts_failed error=%s", exc)
            return []
