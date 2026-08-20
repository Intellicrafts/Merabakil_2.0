from __future__ import annotations

import operator
from typing import Annotated, Optional

from langgraph.graph import MessagesState


class LegalAgentState(MessagesState):
    """State passed between agent nodes in the tool-calling loop.

    messages     — LangGraph-managed message list (add_messages reducer from MessagesState)
    kb_results   — accumulated RetrievedSource objects from all KB tool calls
    web_results  — accumulated WebSearchResult objects from all web tool calls
    iterations   — count of agent→LLM calls made so far
    session_id / user_id — request context propagated from OrchestratorState
    search_filters       — SearchFilters forwarded to the KB tool (stored as object)
    user_token           — Bearer token forwarded to the retriever service
    """

    session_id: Optional[str]
    user_id: Optional[str]
    search_filters: Optional[object]  # legalos_common.rag.filters.SearchFilters
    user_token: Optional[str]
    top_k: int
    iterations: int
    # operator.add reducer allows tool nodes to append across concurrent graph updates
    kb_results: Annotated[list, operator.add]      # list[RetrievedSource]
    web_results: Annotated[list, operator.add]     # list[WebSearchResult]
    lawyer_results: Annotated[list, operator.add]  # list[LawyerMatchResult] from get_lawyer tool
