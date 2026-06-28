"""Heuristic, explainable confidence scoring for RAG answers."""

from __future__ import annotations

from statistics import mean, pstdev

from legalos_common.rag.schemas import ConfidenceBreakdown, RetrievedSource


def score_confidence(
    sources: list[RetrievedSource], *, target_sources: int = 5
) -> ConfidenceBreakdown:
    """Combine retrieval strength, source agreement and coverage into [0, 1].

    - retrieval_strength: mean of the top source similarity scores.
    - source_agreement: inverse of score dispersion (consistent scores -> higher).
    - coverage: how many sources we found relative to a target.
    """
    if not sources:
        return ConfidenceBreakdown(
            retrieval_strength=0.0,
            source_agreement=0.0,
            coverage=0.0,
            overall=0.0,
        )

    scores = [max(0.0, min(1.0, s.score)) for s in sources]
    retrieval_strength = round(mean(scores), 4)

    dispersion = pstdev(scores) if len(scores) > 1 else 0.0
    source_agreement = round(max(0.0, 1.0 - dispersion), 4)

    coverage = round(min(1.0, len(sources) / target_sources), 4)

    overall = round(
        0.5 * retrieval_strength + 0.3 * source_agreement + 0.2 * coverage,
        4,
    )
    return ConfidenceBreakdown(
        retrieval_strength=retrieval_strength,
        source_agreement=source_agreement,
        coverage=coverage,
        overall=overall,
    )
