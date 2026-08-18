from __future__ import annotations

import logging
from typing import Annotated

from langchain_core.messages import ToolMessage
from langchain_core.tools import tool, InjectedToolCallId
from langgraph.prebuilt import InjectedState
from langgraph.types import Command

from legalos_common.clients.web_search import search_web_text

logger = logging.getLogger(__name__)


def _format_web_results(results: list, offset: int) -> str:
    if not results:
        return "No relevant web results found for this query."
    parts = []
    for i, r in enumerate(results, 1):
        idx = offset + i
        parts.append(f"[WEB-{idx}] {r.title}\nURL: {r.url}\n{r.snippet[:500]}")
    return "\n\n---\n\n".join(parts)


def build_web_tool(max_results: int = 5, tavily_api_key: str = ""):
    """Factory: builds the web search tool with a configurable result cap."""

    @tool(parse_docstring=True)
    async def search_web(
        query: str,
        num_results: int = 5,
        state: Annotated[dict, InjectedState] = None,
        tool_call_id: Annotated[str, InjectedToolCallId] = None,
    ) -> Command:
        """Search the web for recent Indian legal news, Supreme Court judgments, and current legal developments.

        Use this when:
        - The question involves very recent events or judgments (post-2023)
        - The knowledge base returns no or insufficient results
        - You need to verify the current status of a law, amendment, or ruling
        Results are cited as [WEB-1], [WEB-2], etc.

        Args:
            query: Search query. Include 'India' or 'Supreme Court India' for legal specificity.
            num_results: Number of web results to fetch (1-10).
        """
        current_web: list = (state or {}).get("web_results", [])
        offset = len(current_web)
        actual = min(max(1, num_results), max_results)

        try:
            results = await search_web_text(f"{query} India law", max_results=actual, tavily_api_key=tavily_api_key)
        except Exception as exc:
            logger.warning("Web tool search failed: %s", exc)
            results = []

        content = _format_web_results(results, offset)
        return Command(update={
            "web_results": current_web + results,
            "messages": [ToolMessage(content=content, tool_call_id=tool_call_id)],
        })

    return search_web
