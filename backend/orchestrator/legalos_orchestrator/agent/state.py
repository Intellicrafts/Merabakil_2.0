from __future__ import annotations

from typing import Optional

from langgraph.graph import MessagesState


class LegalAgentState(MessagesState):
    """State passed between agent nodes in the tool-calling loop.

    messages     — LangGraph-managed message list (add_messages reducer from MessagesState)
    run_id       — key into the per-run SourceRegistry (agent/registry.py) where tools
                   record sources, lawyers and bookings with stable citation numbers
    tool_profile — which tools the model may call: "full" | "no_booking" | "research"
    iterations   — count of agent→LLM calls made so far
    session_id / user_id — request context propagated from OrchestratorState
    search_filters       — SearchFilters forwarded to the KB tool (stored as object)
    user_token           — Bearer token forwarded to the retriever / marketplace
    """

    run_id: str
    tool_profile: str
    use_fast: bool  # fallback run on the fast model after the primary failed
    session_id: Optional[str]
    user_id: Optional[str]
    search_filters: Optional[object]  # legalos_common.rag.filters.SearchFilters
    user_token: Optional[str]
    iterations: int
