"""Re-ranking. Default is a lexical relevance reranker (offline-safe).

A cross-encoder reranker can be substituted by implementing ``Reranker`` and
wiring it in the container - the search use case depends only on the protocol.
"""

from __future__ import annotations

import math
import re
from typing import Protocol

from app.domain.fusion import ScoredHit

_WORD_RE = re.compile(r"[a-zA-Z0-9]+")
_ARTICLE_RE = re.compile(r"\barticle\s+(\d+[a-z]?)\b", re.IGNORECASE)


class Reranker(Protocol):
    def rerank(self, query: str, hits: list[ScoredHit], *, top_k: int) -> list[ScoredHit]: ...


class LexicalReranker:
    """Blends fusion rank with query-document lexical overlap (cosine over TF).

    Cheap, deterministic and dependency-free; meaningfully improves ordering of
    fused candidates without a heavyweight model.
    """

    def __init__(self, *, alpha: float = 0.6) -> None:
        # alpha weights lexical relevance vs. the incoming fusion score.
        self._alpha = alpha

    @staticmethod
    def _tokens(text: str) -> list[str]:
        return _WORD_RE.findall(text.lower())

    def _overlap_score(self, query_tokens: list[str], doc_text: str) -> float:
        if not query_tokens:
            return 0.0
        doc_tokens = self._tokens(doc_text)
        if not doc_tokens:
            return 0.0
        doc_set = {}
        for t in doc_tokens:
            doc_set[t] = doc_set.get(t, 0) + 1
        matched = sum(doc_set.get(t, 0) for t in set(query_tokens))
        # Normalise by document length to avoid favouring long chunks.
        return matched / (1.0 + math.log1p(len(doc_tokens)))

    @staticmethod
    def _article_boost(query: str, doc_text: str) -> float:
        article_numbers = _ARTICLE_RE.findall(query)
        if not article_numbers:
            return 0.0

        lowered = doc_text.lower()
        boost = 0.0
        for article in article_numbers:
            escaped = re.escape(article.lower())
            if re.search(rf"\barticle\s+{escaped}\b", lowered):
                boost += 1.0
            if re.search(rf'(?:^|[\n"\s]){escaped}\.\s+', lowered):
                boost += 1.5
        return boost

    def rerank(self, query: str, hits: list[ScoredHit], *, top_k: int) -> list[ScoredHit]:
        if not hits:
            return []
        query_tokens = self._tokens(query)

        max_fusion = max((h.score for h in hits), default=1.0) or 1.0
        lexical_scores = [
            self._overlap_score(query_tokens, h.payload.get("content", "")) for h in hits
        ]
        max_lexical = max(lexical_scores, default=1.0) or 1.0

        rescored: list[ScoredHit] = []
        for hit, lexical in zip(hits, lexical_scores, strict=True):
            norm_fusion = hit.score / max_fusion
            norm_lexical = lexical / max_lexical
            article_boost = self._article_boost(query, hit.payload.get("content", ""))
            blended = (
                self._alpha * norm_lexical
                + (1 - self._alpha) * norm_fusion
                + article_boost
            )
            rescored.append(
                ScoredHit(
                    id=hit.id,
                    payload=hit.payload,
                    score=round(blended, 6),
                    sources=hit.sources,
                )
            )
        rescored.sort(key=lambda h: h.score, reverse=True)
        return rescored[:top_k]
