"""Supplement corpus retrieval with public web search when local knowledge is thin."""

from __future__ import annotations

import asyncio

from legalos_common.clients.web_search import search_web_images, search_web_text
from legalos_common.rag.confidence import score_confidence
from legalos_orchestrator.agents.base import Agent
from legalos_orchestrator.conversation import is_conversational
from legalos_orchestrator.conversation import expand_retrieval_query
from legalos_orchestrator.schemas import OrchestratorState

_CORPUS_CONFIDENCE_THRESHOLD = 0.5
_TOP_SCORE_THRESHOLD = 0.38


def should_supplement_with_web(state: OrchestratorState) -> bool:
    if is_conversational(state.query):
        return False
    confidence = score_confidence(state.sources)
    if not state.sources:
        return True
    if confidence.overall < _CORPUS_CONFIDENCE_THRESHOLD:
        return True
    top_score = max(s.score for s in state.sources)
    return top_score < _TOP_SCORE_THRESHOLD


class WebSearchAgent(Agent):
    name = "web_search_agent"

    async def run(self, state: OrchestratorState) -> dict:
        if not should_supplement_with_web(state):
            return {}

        query = expand_retrieval_query(state.query, state.history)
        search_query = f"{query} India law legal"
        web_sources, web_images = await asyncio.gather(
            search_web_text(search_query, max_results=5),
            search_web_images(query, max_results=2),
        )
        if not web_sources and not web_images:
            return {}

        return {
            "web_sources": web_sources,
            "web_images": web_images,
            "metadata": {**state.metadata, "web_search_used": True},
        }
