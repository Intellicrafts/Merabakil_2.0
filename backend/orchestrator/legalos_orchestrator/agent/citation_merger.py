from __future__ import annotations

import re

from legalos_common.rag.schemas import Citation, RetrievedSource, WebSearchResult


def merge_citations(
    answer: str,
    kb_results: list[RetrievedSource],
    web_results: list[WebSearchResult],
) -> tuple[list[Citation], list[WebSearchResult]]:
    """Parse [KB-N] and [WEB-N] markers from the answer and build typed citation objects.

    Returns:
        kb_citations  — Citation objects for each unique [KB-N] reference found in the answer
        web_citations — WebSearchResult entries for each unique [WEB-N] reference found
    """
    kb_citations: list[Citation] = []
    seen_kb: set[int] = set()

    for m in re.finditer(r"\[KB-(\d+)\]", answer):
        idx = int(m.group(1))
        if idx in seen_kb:
            continue
        seen_kb.add(idx)
        if 1 <= idx <= len(kb_results):
            src = kb_results[idx - 1]
            kb_citations.append(Citation(
                marker=f"[KB-{idx}]",
                title=src.title,
                citation=src.citation,
                document_id=src.document_id,
                section=src.section,
            ))

    web_citations: list[tuple[int, WebSearchResult]] = []
    seen_web: set[int] = set()

    for m in re.finditer(r"\[WEB-(\d+)\]", answer):
        idx = int(m.group(1))
        if idx in seen_web:
            continue
        seen_web.add(idx)
        if 1 <= idx <= len(web_results):
            web_citations.append((idx, web_results[idx - 1]))

    kb_citations.sort(key=lambda c: int(c.marker.replace("[KB-", "").replace("]", "")))
    sorted_web = [r for _, r in sorted(web_citations, key=lambda x: x[0])]

    return kb_citations, sorted_web
