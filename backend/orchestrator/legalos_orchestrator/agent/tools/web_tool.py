from __future__ import annotations

import logging
from typing import Annotated

from langchain_core.messages import ToolMessage
from langchain_core.tools import InjectedToolCallId, tool
from langgraph.prebuilt import InjectedState
from langgraph.types import Command

from legalos_common.clients.web_search import search_web_text
from legalos_orchestrator.agent.registry import get_registry

logger = logging.getLogger(__name__)


def build_web_tool(max_results: int = 5, tavily_api_key: str = ""):
    """Factory: builds the web search tool with a configurable result cap."""

    @tool(parse_docstring=True)
    async def search_web(
        query: str,
        num_results: int = 5,
        state: Annotated[dict, InjectedState] = None,
        tool_call_id: Annotated[str, InjectedToolCallId] = None,
    ) -> Command:
        """Search the web for recent Indian legal developments (judgments, amendments, notifications).

        Use this when the question is about something from 2024 onwards, or when the
        knowledge base has nothing relevant. Results are cited as [WEB-1], [WEB-2], etc.

        Args:
            query: Search query in English. Include 'India' or the court name for legal specificity.
            num_results: Number of web results to fetch (1-5).
        """
        registry = get_registry(state)
        actual = min(max(1, num_results), max_results)
        try:
            results = await search_web_text(
                f"{query} India law", max_results=actual, tavily_api_key=tavily_api_key
            )
        except Exception as exc:
            logger.warning("web_tool_search_failed error=%s", exc)
            results = []

        if results:
            content = "\n\n---\n\n".join(
                f"[WEB-{registry.add_web(r)}] {r.title}\nURL: {r.url}\n{(r.snippet or '')[:500]}"
                for r in results
            )
        else:
            content = "No relevant web results found for this query."
        return Command(update={"messages": [ToolMessage(content=content, tool_call_id=tool_call_id)]})

    return search_web
