"""Shared in-memory legal corpus for native dev servers."""
from __future__ import annotations

from typing import Any

CORPUS: list[dict[str, Any]] = [
    {
        "id": "contract-act-s10",
        "chunk_id": "contract-act-s10:0",
        "document_id": "contract-act-s10",
        "title": "Indian Contract Act, 1872 — Section 10",
        "doc_type": "central_act",
        "jurisdiction": "india",
        "citation": "Act 9 of 1872",
        "section": "10",
        "content": (
            "Section 10. What agreements are contracts. All agreements are contracts if they "
            "are made by the free consent of parties competent to contract, for a lawful "
            "consideration and with a lawful object, and are not hereby expressly declared "
            "to be void."
        ),
    },
    {
        "id": "ipc-s420",
        "chunk_id": "ipc-s420:0",
        "document_id": "ipc-s420",
        "title": "Indian Penal Code, 1860 — Section 420",
        "doc_type": "central_act",
        "jurisdiction": "india",
        "citation": "IPC 1860",
        "section": "420",
        "content": (
            "Section 420. Cheating and dishonestly inducing delivery of property. Whoever "
            "cheats and thereby dishonestly induces the person deceived to deliver any "
            "property shall be punished with imprisonment and fine."
        ),
    },
    {
        "id": "kesavananda",
        "chunk_id": "kesavananda:0",
        "document_id": "kesavananda",
        "title": "Kesavananda Bharati v. State of Kerala",
        "doc_type": "judgment",
        "jurisdiction": "supreme_court",
        "citation": "AIR 1973 SC 1461",
        "section": None,
        "content": (
            "The Supreme Court held that Parliament cannot amend the basic structure of the "
            "Constitution, including supremacy of the Constitution, secularism, and judicial review."
        ),
    },
]


class MemVectorStore:
    def __init__(self, embedder, corpus: list[dict[str, Any]]) -> None:  # noqa: ANN001
        self._embedder = embedder
        self._corpus = corpus
        self._vecs: dict[str, list[float]] = {}

    async def warm(self) -> None:
        texts = [d["content"] for d in self._corpus]
        for doc, vec in zip(self._corpus, await self._embedder.embed(texts), strict=True):
            self._vecs[doc["id"]] = vec

    async def search(self, vector, *, limit, filters):  # noqa: ANN001
        out = []
        for doc in self._corpus:
            if filters:
                if filters.get("doc_type") and doc.get("doc_type") != filters["doc_type"]:
                    continue
                if filters.get("jurisdiction") and doc.get("jurisdiction") != filters["jurisdiction"]:
                    continue
            vec = self._vecs[doc["id"]]
            score = sum(a * b for a, b in zip(vector, vec, strict=True))
            out.append({"id": doc["id"], "score": score, "payload": doc})
        out.sort(key=lambda h: h["score"], reverse=True)
        return out[:limit]


class MemKeywordStore:
    def __init__(self, corpus: list[dict[str, Any]]) -> None:
        self._corpus = corpus

    async def search(self, query, *, size, filters):  # noqa: ANN001
        q = query.lower()
        hits = []
        for doc in self._corpus:
            if filters:
                if filters.get("doc_type") and doc.get("doc_type") != filters["doc_type"]:
                    continue
                if filters.get("jurisdiction") and doc.get("jurisdiction") != filters["jurisdiction"]:
                    continue
            text = f"{doc.get('title', '')} {doc['content']}".lower()
            score = sum(1 for w in q.split() if w in text)
            if score:
                hits.append({"id": doc["id"], "score": float(score), "payload": doc})
        hits.sort(key=lambda h: h["score"], reverse=True)
        return hits[:size]
