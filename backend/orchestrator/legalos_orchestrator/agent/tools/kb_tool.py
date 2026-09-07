from __future__ import annotations

import asyncio
import logging
from typing import Annotated, Optional

from langchain_core.messages import ToolMessage
from langchain_core.tools import tool
from langchain_core.tools import InjectedToolCallId
from langgraph.prebuilt import InjectedState
from langgraph.types import Command

from legalos_common.rag.filters import SearchFilters
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
        session_doc_ids: list[str] = (state or {}).get("session_document_ids") or []
        user_token = (state or {}).get("user_token") or None
        actual_top_k = min(max(1, top_k), 12)

        try:
            if session_doc_ids and not filters:
                # Dual retrieval: session documents + legal corpus, merged with docs first
                half_k = max(3, actual_top_k // 2)
                doc_results, corpus_results = await asyncio.gather(
                    retriever.retrieve(
                        query, top_k=half_k,
                        filters=SearchFilters(document_ids=session_doc_ids),
                        user_token=user_token,
                    ),
                    retriever.retrieve(query, top_k=half_k, filters=None, user_token=user_token),
                    return_exceptions=True,
                )
                doc_results = doc_results if not isinstance(doc_results, Exception) else []
                corpus_results = corpus_results if not isinstance(corpus_results, Exception) else []
                seen: set[str] = set()
                sources = []
                for src in [*doc_results, *corpus_results]:
                    if src.chunk_id not in seen:
                        seen.add(src.chunk_id)
                        sources.append(src)
                sources = sources[:actual_top_k]
            else:
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
