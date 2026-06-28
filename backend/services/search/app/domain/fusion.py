"""Reciprocal Rank Fusion (RRF) for combining ranked result lists."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ScoredHit:
    id: str
    payload: dict[str, Any]
    score: float
    sources: set[str] = field(default_factory=set)


def reciprocal_rank_fusion(
    result_lists: dict[str, list[dict[str, Any]]],
    *,
    k: int = 60,
) -> list[ScoredHit]:
    """Fuse multiple ranked lists into one using RRF.

    ``result_lists`` maps a retrieval-method name (e.g. "vector", "keyword") to a
    ranked list of hits (each a dict with "id" and "payload"). RRF score for a
    document is sum over lists of 1 / (k + rank), which is robust to differing
    score scales between retrievers.
    """
    fused: dict[str, ScoredHit] = {}
    for method, hits in result_lists.items():
        for rank, hit in enumerate(hits):
            doc_id = hit["id"]
            contribution = 1.0 / (k + rank + 1)
            if doc_id not in fused:
                fused[doc_id] = ScoredHit(
                    id=doc_id,
                    payload=hit.get("payload", {}),
                    score=0.0,
                )
            fused[doc_id].score += contribution
            fused[doc_id].sources.add(method)
            # Prefer a payload that actually has content.
            if not fused[doc_id].payload.get("content") and hit.get("payload", {}).get("content"):
                fused[doc_id].payload = hit["payload"]

    return sorted(fused.values(), key=lambda h: h.score, reverse=True)
