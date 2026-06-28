"""Context assembly + citation tracking for grounded answers."""

from __future__ import annotations

from legalos_common.rag.schemas import Citation, RetrievedSource


def assemble_context(sources: list[RetrievedSource]) -> tuple[str, list[Citation]]:
    """Build a numbered, citation-tracked context block from retrieved sources.

    Returns the context string (fed to the LLM) and the list of citations whose
    markers correspond to the numbered blocks, enabling source attribution.
    """
    blocks: list[str] = []
    citations: list[Citation] = []
    for idx, src in enumerate(sources, start=1):
        marker = f"[{idx}]"
        header = src.citation or src.title or src.document_id
        section = f" (Section {src.section})" if src.section else ""
        blocks.append(f"{marker} {header}{section}\n{src.content.strip()}")
        citations.append(
            Citation(
                marker=marker,
                title=src.title,
                citation=src.citation,
                document_id=src.document_id,
                section=src.section,
            )
        )
    return "\n\n".join(blocks), citations
