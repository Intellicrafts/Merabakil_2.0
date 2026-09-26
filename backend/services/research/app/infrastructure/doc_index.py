"""Temporary, per-user index of uploaded documents for Saarthi conversations.

User files never enter the shared legal knowledge base. When a document is used
in a chat, its extracted text (from the document service) is:
  - short  (≤ SMALL_DOC_CHARS): kept whole and given to the model as-is;
  - long: split into overlapping passages, embedded, and stored in Redis, so each
    question gets the document's opening plus the passages most relevant to it.

Everything is keyed by owner + document and expires after `ttl` seconds without
use (sliding). It's rebuilt on demand from the extracted text, and dropped
immediately on detach / chat delete / "forget me".
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from dataclasses import dataclass

import numpy as np

logger = logging.getLogger(__name__)

SMALL_DOC_CHARS = 20_000
CHUNK_CHARS = 1_400
CHUNK_OVERLAP = 200
MAX_CHUNKS = 600  # ~800k characters; longer files are indexed up to this point
PROMPT_BUDGET_CHARS = 24_000
OPENING_CHARS = 1_500
TOP_K = 8

_KEY = "research:docidx:{owner}:{doc}"


def _key(owner: str, document_id: str) -> str:
    return _KEY.format(owner=owner, doc=document_id)


def chunk_text(text: str) -> list[str]:
    """Overlapping passages, preferring to break at paragraph or sentence ends."""
    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n and len(chunks) < MAX_CHUNKS:
        end = min(n, start + CHUNK_CHARS)
        if end < n:
            floor = start + CHUNK_CHARS // 2
            cut = max(text.rfind("\n", floor, end), text.rfind(". ", floor, end))
            if cut > start:
                end = cut + 1
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


@dataclass
class _Entry:
    title: str
    mode: str  # "full" | "indexed"
    text: str = ""
    chunks: list[str] | None = None
    vectors: np.ndarray | None = None  # (n, dim) float32, L2-normalised


class DocumentContext:
    def __init__(self, redis, embedder, texts, *, ttl: int = 7200) -> None:
        self._redis = redis
        self._embedder = embedder
        self._texts = texts  # DocumentTextClient
        self._ttl = ttl
        self._building: dict[str, asyncio.Task] = {}

    # ── storage ──────────────────────────────────────────────────────────────

    async def _load(self, key: str) -> tuple[str, _Entry] | None:
        if not self._redis:
            return None
        raw = await self._redis.hgetall(key)
        if not raw:
            return None
        fields = {(k.decode() if isinstance(k, bytes) else k): v for k, v in raw.items()}
        as_text = lambda v: v.decode() if isinstance(v, bytes) else v  # noqa: E731
        meta = json.loads(as_text(fields["meta"]))
        entry = _Entry(title=meta["title"], mode=meta["mode"])
        if entry.mode == "full":
            entry.text = as_text(fields["text"])
        else:
            entry.chunks = json.loads(as_text(fields["chunks"]))
            vecs = fields["vecs"] if isinstance(fields["vecs"], bytes) else fields["vecs"].encode("latin-1")
            entry.vectors = np.frombuffer(vecs, dtype=np.float32).reshape(meta["n"], meta["dim"])
        await self._redis.expire(key, self._ttl)  # sliding expiry: still in use
        return meta["hash"], entry

    async def _store(self, key: str, content_hash: str, entry: _Entry) -> None:
        if not self._redis:
            return
        meta = {"title": entry.title, "mode": entry.mode, "hash": content_hash}
        mapping: dict[str, bytes | str] = {}
        if entry.mode == "full":
            mapping["text"] = entry.text
        else:
            meta.update(n=int(entry.vectors.shape[0]), dim=int(entry.vectors.shape[1]))
            mapping["chunks"] = json.dumps(entry.chunks, ensure_ascii=False)
            mapping["vecs"] = entry.vectors.astype(np.float32).tobytes()
        mapping["meta"] = json.dumps(meta)
        await self._redis.delete(key)
        await self._redis.hset(key, mapping=mapping)
        await self._redis.expire(key, self._ttl)

    # ── build ────────────────────────────────────────────────────────────────

    async def _build(self, owner: str, document_id: str, user_token: str) -> _Entry | None:
        key = _key(owner, document_id)
        # The document service checks ownership; no access → nothing is indexed.
        fetched = await self._texts.fetch_full(document_id, user_token=user_token)
        if fetched is None:
            await self.drop(owner, [document_id])
            return None
        title, text = fetched
        content_hash = hashlib.sha256(text.encode()).hexdigest()

        cached = await self._load(key)
        if cached and cached[0] == content_hash:
            return cached[1]

        if len(text) <= SMALL_DOC_CHARS:
            entry = _Entry(title=title, mode="full", text=text)
        else:
            chunks = chunk_text(text)
            try:
                vectors = np.asarray(await self._embedder.embed(chunks), dtype=np.float32)
            except Exception as exc:
                # Degrade to the opening of the file for this turn; don't cache.
                logger.warning("doc_index_embed_failed error=%s", type(exc).__name__)
                return _Entry(title=title, mode="full", text=text[:PROMPT_BUDGET_CHARS])
            norms = np.linalg.norm(vectors, axis=1, keepdims=True)
            vectors = vectors / np.where(norms == 0, 1.0, norms)
            entry = _Entry(title=title, mode="indexed", chunks=chunks, vectors=vectors)

        await self._store(key, content_hash, entry)
        return entry

    async def _entry(self, owner: str, document_id: str, user_token: str) -> _Entry | None:
        key = _key(owner, document_id)
        task = self._building.get(key)
        if task is None:
            # One build per document at a time (e.g. attach warm-up + first question).
            task = asyncio.create_task(self._build(owner, document_id, user_token))
            self._building[key] = task
            task.add_done_callback(lambda _t, k=key: self._building.pop(k, None))
        try:
            return await asyncio.shield(task)
        except Exception as exc:
            logger.warning("doc_index_build_failed error=%s", type(exc).__name__)
            return None

    async def prepare(self, *, owner: str, document_id: str, user_token: str) -> None:
        """Warm the index when a file is attached, so the first question is fast."""
        await self._entry(owner, document_id, user_token)

    # ── query ────────────────────────────────────────────────────────────────

    async def context_for(
        self, *, owner: str, document_ids: list[str], query: str, user_token: str
    ) -> str:
        """Prompt text for this question: whole short files, or the opening plus
        the most relevant passages of long ones — within PROMPT_BUDGET_CHARS."""
        entries = [e for e in await asyncio.gather(*(self._entry(owner, d, user_token) for d in document_ids[:8])) if e]
        if not entries:
            return ""
        budget = PROMPT_BUDGET_CHARS // len(entries)

        query_vec: np.ndarray | None = None
        if any(e.mode == "indexed" for e in entries):
            try:
                q = np.asarray(await self._embedder.embed_one(query), dtype=np.float32)
                query_vec = q / (np.linalg.norm(q) or 1.0)
            except Exception as exc:
                logger.warning("doc_index_query_embed_failed error=%s", type(exc).__name__)

        parts = []
        for e in entries:
            if e.mode == "full":
                parts.append(f"### {e.title} (the user's uploaded file)\n{e.text[:budget]}")
                continue
            parts.append(self._passages(e, query_vec, budget))
        return (
            "USER-UPLOADED DOCUMENTS (the user's own files — evidence, not law; refer to "
            "them by name, never with [KB-n] markers):\n\n" + "\n\n".join(parts)
        )

    @staticmethod
    def _passages(e: _Entry, query_vec: np.ndarray | None, budget: int) -> str:
        chunks = e.chunks or []
        n = len(chunks)
        if query_vec is None or e.vectors is None:
            picked = list(range(min(n, TOP_K)))
        else:
            scores = e.vectors @ query_vec
            picked = sorted(int(i) for i in np.argsort(-scores)[:TOP_K])
        header = (
            f"### {e.title} (the user's uploaded file — {n} passages; showing the opening "
            "and the passages most relevant to this question)"
        )
        out = [header, f"[Opening]\n{chunks[0][:OPENING_CHARS]}" if chunks else ""]
        used = sum(len(p) for p in out)
        for i in picked:
            if i == 0:
                continue
            block = f"[Passage {i + 1} of {n}]\n{chunks[i]}"
            if used + len(block) > budget:
                break
            out.append(block)
            used += len(block)
        return "\n\n".join(p for p in out if p)

    # ── cleanup ──────────────────────────────────────────────────────────────

    async def drop(self, owner: str, document_ids: list[str]) -> None:
        if self._redis and document_ids:
            await self._redis.delete(*[_key(owner, d) for d in document_ids])

    async def drop_all(self, owner: str) -> None:
        if not self._redis:
            return
        keys = [k async for k in self._redis.scan_iter(match=_key(owner, "*"))]
        if keys:
            await self._redis.delete(*keys)
