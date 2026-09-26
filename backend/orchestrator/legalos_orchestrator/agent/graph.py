from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from langchain_core.messages import AIMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from legalos_orchestrator.agent.state import LegalAgentState

logger = logging.getLogger(__name__)

# Which tools each kind of user may trigger. Guests get research only; roles that
# cannot book (advocates, firms, admins) still get lawyer discovery.
TOOL_PROFILES: dict[str, tuple[str, ...]] = {
    "full": ("search_legal_knowledge_base", "search_web", "get_lawyer", "book_appointment"),
    "no_booking": ("search_legal_knowledge_base", "search_web", "get_lawyer"),
    "research": ("search_legal_knowledge_base", "search_web"),
}

_LLM_TIMEOUT_S = 60
_LLM_MAX_RETRIES = 2  # SDK-level retries happen before any token is streamed


def _chat_model(model: str, api_key: str) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=model,
        google_api_key=api_key,
        streaming=True,
        timeout=_LLM_TIMEOUT_S,
        max_retries=_LLM_MAX_RETRIES,
    )


def content_text(content) -> str:
    """Flatten Gemini message content (str or list of parts) to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"
        )
    return ""


class AgentGraph:
    """LangGraph ReAct agent: Gemini + legal KB, web, lawyer and booking tools."""

    def __init__(
        self,
        kb_tool,
        web_tool,
        lawyer_tool=None,
        book_appointment_tool=None,
        llm_model: str = "",
        llm_api_key: str = "",
        max_iterations: int = 3,
        fast_llm_model: str = "",
    ) -> None:
        self._max_iter = max_iterations

        tools = [t for t in (kb_tool, web_tool, lawyer_tool, book_appointment_tool) if t is not None]
        by_name = {t.name: t for t in tools}

        primary = _chat_model(llm_model, llm_api_key)
        fast_model = fast_llm_model or llm_model
        fast = _chat_model(fast_model, llm_api_key) if fast_model != llm_model else primary

        # (profile, use_fast) → model bound to that profile's tools
        self._bound: dict[tuple[str, bool], object] = {}
        for profile, names in TOOL_PROFILES.items():
            profile_tools = [by_name[n] for n in names if n in by_name]
            self._bound[(profile, False)] = primary.bind_tools(profile_tools)
            self._bound[(profile, True)] = fast.bind_tools(profile_tools)
        self._plain = {False: primary, True: fast}  # final forced turn: no tools
        self._llm_fast = fast

        builder = StateGraph(LegalAgentState)
        builder.add_node("agent", self._agent_node)
        builder.add_node("tools", ToolNode(tools))
        builder.add_edge(START, "agent")
        builder.add_conditional_edges("agent", self._route)
        builder.add_edge("tools", "agent")
        self.graph = builder.compile()

    async def _agent_node(self, state: LegalAgentState) -> dict:
        messages = list(state["messages"])
        iteration = state.get("iterations", 0)
        use_fast = bool(state.get("use_fast"))

        if iteration >= self._max_iter - 1:
            messages.append(
                SystemMessage(
                    content="You have used the maximum number of tool calls. Write your final "
                    "answer now using only the information already gathered."
                )
            )
            llm = self._plain[use_fast]
        else:
            profile = state.get("tool_profile") or "research"
            llm = self._bound.get((profile, use_fast)) or self._bound[("research", use_fast)]

        response = await llm.ainvoke(messages)
        return {"messages": [response], "iterations": iteration + 1}

    def _route(self, state: LegalAgentState) -> str:
        last = state["messages"][-1]
        if isinstance(last, AIMessage) and last.tool_calls and state.get("iterations", 0) < self._max_iter:
            return "tools"
        return END

    async def astream_events(self, initial_state: LegalAgentState) -> AsyncIterator[dict]:
        async for event in self.graph.astream_events(initial_state, version="v2"):
            yield event

    async def astream_direct(self, messages: list) -> AsyncIterator:
        """Stream directly from the fast LLM — no tools, no graph overhead."""
        async for chunk in self._llm_fast.astream(messages):
            yield chunk

    async def complete_fast(self, messages: list) -> str:
        """Non-streaming completion on the fast LLM — suggestions and other light tasks."""
        response = await self._llm_fast.ainvoke(messages)
        return content_text(response.content)
