"""Research agent: hybrid retrieval through the Search service."""

from __future__ import annotations

from legalos_orchestrator.agents.base import Agent
from legalos_orchestrator.conversation import expand_retrieval_query
from legalos_orchestrator.ports import RetrieverPort
from legalos_orchestrator.schemas import OrchestratorState, ResearchScope
from legalos_common.rag.filters import SearchFilters


class ResearchAgent(Agent):
    name = "research_agent"

    def __init__(self, retriever: RetrieverPort, *, top_k: int = 8) -> None:
        self._retriever = retriever
        self._top_k = top_k

    async def run(self, state: OrchestratorState) -> dict:
        filters = SearchFilters.model_validate(state.search_filters.model_dump())

        if state.jurisdiction and state.jurisdiction.level in {
            "supreme_court",
            "high_court",
            "tribunal",
        }:
            if not filters.jurisdiction:
                filters = filters.model_copy(
                    update={"jurisdiction": state.jurisdiction.level}
                )

        if state.scope is ResearchScope.DOCUMENT and not (
            filters.document_id or filters.document_ids
        ):
            return {"sources": [], "metadata": {**state.metadata, "retrieved": 0}}

        sources = await self._retriever.retrieve(
            expand_retrieval_query(state.query, state.history),
            top_k=self._top_k,
            filters=None if filters.is_empty() else filters,
            user_token=state.user_token,
        )
        return {"sources": sources, "metadata": {**state.metadata, "retrieved": len(sources)}}
