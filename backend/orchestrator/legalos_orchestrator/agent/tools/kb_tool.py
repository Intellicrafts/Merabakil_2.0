from __future__ import annotations

import logging
from typing import Annotated, Optional

from langchain_core.messages import ToolMessage
from langchain_core.tools import tool
from langchain_core.tools import InjectedToolCallId
from langgraph.prebuilt import InjectedState
from langgraph.types import Command

from legalos_orchestrator.ports import RetrieverPort

logger = logging.getLogger(__name__)


def _format_sources(sources: list, offset: int) -> str:
    if not sources:
        return "No relevant documents found in the Indian legal knowledge base for this query."
    parts = []
    for i, src in enumerate(sources, 1):
        idx = offset + i
        header_parts = [f"[KB-{idx}]"]
        if src.title:
            header_parts.append(src.title)
        if src.citation:
            header_parts.append(f"| {src.citation}")
        if src.doc_type:
            header_parts.append(f"({src.doc_type})")
        body = src.content[:700]
        parts.append(" ".join(header_parts) + "\n" + body)
    return "\n\n---\n\n".join(parts)


def build_kb_tool(retriever: RetrieverPort):
    """Factory: closes over the retriever port instance."""

    @tool(parse_docstring=True)
    async def search_legal_knowledge_base(
        query: str,
        top_k: int = 8,
        state: Annotated[dict, InjectedState] = None,
        tool_call_id: Annotated[str, InjectedToolCallId] = None,
    ) -> Command:
        """Search the Indian legal knowledge base using hybrid dense + sparse retrieval.

        Use this as the primary tool for any legal question requiring accurate citation.
        Results are cited in the answer as [KB-1], [KB-2], etc.

        Args:
            query: Specific legal question or topic. Include article numbers, legal terms, or case names when known.
            top_k: Number of results to return (default 8, max 12).
        """
        current_kb: list = (state or {}).get("kb_results", [])
        offset = len(current_kb)

        filters = (state or {}).get("search_filters") or None
        user_token = (state or {}).get("user_token") or None
        actual_top_k = min(max(1, top_k), 12)

        try:
            sources = await retriever.retrieve(
                query,
                top_k=actual_top_k,
                filters=filters,
                user_token=user_token,
            )
        except Exception as exc:
            logger.error("KB tool retrieval failed: %s", exc)
            sources = []

        content = _format_sources(sources, offset)
        return Command(update={
            "kb_results": current_kb + sources,
            "messages": [ToolMessage(content=content, tool_call_id=tool_call_id)],
        })

    return search_legal_knowledge_base
