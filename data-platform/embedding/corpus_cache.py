"""Persistent embedding cache for native dev search (incremental warm)."""

from __future__ import annotations

import json
import pickle
import sys
from pathlib import Path
from typing import Any, Protocol

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "backend" / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

CACHE_DIR = ROOT / "data" / ".embedding_cache"
VECTORS_PATH = CACHE_DIR / "vectors.pkl"
CHUNK_INDEX_PATH = CACHE_DIR / "chunks.json"


class Embedder(Protocol):
    async def embed(self, texts: list[str]) -> list[list[float]]: ...


def _chunk_hash(text: str) -> str:
    from parsers.types import ParsedDocument

    return ParsedDocument.hash_content(text)


def load_chunk_index() -> dict[str, dict[str, str]]:
    if not CHUNK_INDEX_PATH.is_file():
        return {}
    return json.loads(CHUNK_INDEX_PATH.read_text(encoding="utf-8"))


def save_chunk_index(index: dict[str, dict[str, str]]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CHUNK_INDEX_PATH.write_text(json.dumps(index, indent=2), encoding="utf-8")


def load_vectors() -> dict[str, list[float]]:
    if not VECTORS_PATH.is_file():
        return {}
    with VECTORS_PATH.open("rb") as fh:
        return pickle.load(fh)


def save_vectors(vectors: dict[str, list[float]]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with VECTORS_PATH.open("wb") as fh:
        pickle.dump(vectors, fh, protocol=pickle.HIGHEST_PROTOCOL)


def purge_source_from_cache(source_uri: str) -> None:
    index = load_chunk_index()
    vectors = load_vectors()
    to_drop = [cid for cid, meta in index.items() if meta.get("source_uri") == source_uri]
    for cid in to_drop:
        index.pop(cid, None)
        vectors.pop(cid, None)
    save_chunk_index(index)
    save_vectors(vectors)


async def warm_corpus_vectors(
    corpus: list[dict[str, Any]],
    embedder: Embedder,
    *,
    embedding_model: str = "",
    source_filter: list[str] | None = None,
    force_sources: set[str] | None = None,
) -> tuple[dict[str, list[float]], int, int]:
    """
    Return (chunk_id -> vector, embedded_count, cached_count).
    Only calls embedder for missing/changed chunks or forced sources.
    """
    _ = embedding_model  # reserved for future model-keyed invalidation via manifest
    force_sources = force_sources or set()
    allowed_sources = set(source_filter) if source_filter else None

    index = load_chunk_index()
    vectors = load_vectors()
    embedded = 0
    cached = 0

    live_ids = {d["id"] for d in corpus}
    for cid in list(index.keys()):
        if cid not in live_ids:
            index.pop(cid, None)
            vectors.pop(cid, None)

    missing_texts: list[str] = []
    missing_ids: list[str] = []

    for doc in corpus:
        cid = doc["id"]
        source_uri = doc.get("source_uri") or ""
        if allowed_sources is not None and source_uri not in allowed_sources:
            continue
        text = doc["content"]
        chash = doc.get("content_hash") or _chunk_hash(text)
        prev = index.get(cid)
        force = source_uri in force_sources
        if not force and prev and prev.get("content_hash") == chash and cid in vectors:
            cached += 1
            continue
        missing_ids.append(cid)
        missing_texts.append(text)
        index[cid] = {"content_hash": chash, "source_uri": source_uri}

    batch_size = 32
    for i in range(0, len(missing_texts), batch_size):
        batch_ids = missing_ids[i : i + batch_size]
        batch_texts = missing_texts[i : i + batch_size]
        if not batch_texts:
            continue
        new_vecs = await embedder.embed(batch_texts)
        for cid, vec in zip(batch_ids, new_vecs, strict=True):
            vectors[cid] = vec
            embedded += 1
        done = min(i + batch_size, len(missing_texts))
        if done % 320 == 0 or done == len(missing_texts):
            print(f"  embedded {done}/{len(missing_texts)} new/changed chunks...", flush=True)

    # Keep vectors for corpus entries not in this filter pass
    result: dict[str, list[float]] = {}
    for doc in corpus:
        cid = doc["id"]
        if cid in vectors:
            result[cid] = vectors[cid]

    save_chunk_index(index)
    save_vectors(vectors)
    return result, embedded, cached
