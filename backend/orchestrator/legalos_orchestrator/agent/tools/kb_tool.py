from __future__ import annotations

import asyncio
import logging
from typing import Annotated

from langchain_core.messages import ToolMessage
from langchain_core.tools import InjectedToolCallId, tool
from langgraph.prebuilt import InjectedState
from langgraph.types import Command

from legalos_common.rag.filters import SearchFilters
from legalos_orchestrator.agent.registry import get_registry
from legalos_orchestrator.ports import RetrieverPort

logger = logging.getLogger(__name__)

_NO_RESULTS = (
    "No relevant documents found in the Indian legal knowledge base for this query. "
    "Answer from general knowledge without [KB-n] markers, or use search_web if the "
    "question is about a recent development."
)
_UNAVAILABLE = (
    "The legal knowledge base is temporarily unavailable. Answer from general knowledge "
    "without [KB-n] markers and be explicit about any uncertainty."
)


def _format_sources(numbered: list[tuple[int, object]]) -> str:
    parts = []
    for idx, src in numbered:
        header = [f"[KB-{idx}]"]
        if src.title:
            header.append(src.title)
        if src.citation:
            header.append(f"| {src.citation}")
        if src.section:
            header.append(f"| {src.section}")
        parts.append(" ".join(header) + "\n" + (src.content or "")[:900])
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
        """Search the verified Indian legal knowledge base (statutes, Constitution, case law).

        Use this for any legal question that needs accurate sections, procedures or citations.
        Results are cited in the answer as [KB-1], [KB-2], etc.

        Args:
            query: Specific legal question in English. Include act names, section or article numbers, or legal terms when known.
            top_k: Number of results to return (default 8, max 12).
        """
        registry = get_registry(state)
        filters = (state or {}).get("search_filters") or None
        session_doc_ids: list[str] = (state or {}).get("session_document_ids") or []
        user_token = (state or {}).get("user_token") or None
        actual_top_k = min(max(1, top_k), 12)

        failed = False
        try:
            if session_doc_ids and not filters:
                # Session documents + legal corpus, documents first.
                half_k = max(3, actual_top_k // 2)
                doc_results, corpus_results = await asyncio.gather(
                    retriever.retrieve(
                        query,
                        top_k=half_k,
                        filters=SearchFilters(document_ids=session_doc_ids),
                        user_token=user_token,
                    ),
                    retriever.retrieve(query, top_k=half_k, filters=None, user_token=user_token),
                    return_exceptions=True,
                )
                doc_results = doc_results if not isinstance(doc_results, Exception) else []
                corpus_results = corpus_results if not isinstance(corpus_results, Exception) else []
                sources = [*doc_results, *corpus_results][:actual_top_k]
            else:
                sources = await retriever.retrieve(
                    query, top_k=actual_top_k, filters=filters, user_token=user_token
                )
        except Exception as exc:
            logger.error("kb_tool_retrieval_failed error=%s", exc)
            sources, failed = [], True

        numbered = [(registry.add_kb(src), src) for src in sources]
        if numbered:
            content = _format_sources(numbered)
        else:
            content = _UNAVAILABLE if failed else _NO_RESULTS
        return Command(update={"messages": [ToolMessage(content=content, tool_call_id=tool_call_id)]})

    return search_legal_knowledge_base
