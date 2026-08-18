"""Warm native embedding cache (incremental).

Usage:
  python backend/scripts/embed_corpus.py
  python backend/scripts/embed_corpus.py --source "Indian_constitution/Indian_constitution.json"
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [
    str(ROOT / "backend" / "scripts"),
    str(ROOT / "backend" / "libs" / "legalos_common"),
    str(ROOT / "backend" / "services" / "search"),
    str(ROOT / "data-platform"),
]

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

from corpus_sources import CHUNK_SCHEMA_VERSION  # noqa: E402
from dev_bootstrap import bootstrap_dev_env  # noqa: E402
from dev_corpus_loader import load_raw_data_corpus  # noqa: E402
from embedding.corpus_cache import warm_corpus_vectors  # noqa: E402
from embedding.corpus_manifest import load_manifest, save_manifest, update_source  # noqa: E402


def main() -> int:
    bootstrap_dev_env(ROOT)

    parser = argparse.ArgumentParser(description="Warm native embedding cache")
    parser.add_argument(
        "--source",
        action="append",
        dest="sources",
        default=[],
        help="raw-data relative path (repeatable); forces re-embed for those sources",
    )
    args = parser.parse_args()

    from app.config import get_settings  # noqa: E402
    from legalos_common.clients.llm import StubEmbeddingClient, build_embedding_client  # noqa: E402

    settings = get_settings()
    use_stub = settings.llm.llm_use_stub or settings.llm.embedding_use_stub
    embedder = (
        StubEmbeddingClient(settings.llm.embedding_dim)
        if use_stub
        else build_embedding_client(settings.llm)
    )
    model = settings.llm.embedding_model if not use_stub else "stub"

    print(f"Loading corpus (model={model})...", flush=True)
    corpus = load_raw_data_corpus(include_pdfs=True)
    print(f"Loaded {len(corpus)} chunks", flush=True)

    force = set(args.sources)
    source_filter = args.sources or None

    async def _run() -> tuple[int, int]:
        _, embedded, cached = await warm_corpus_vectors(
            corpus,
            embedder,
            embedding_model=model,
            source_filter=source_filter,
            force_sources=force,
        )
        return embedded, cached

    embedded, cached = asyncio.run(_run())
    print(f"Done: embedded={embedded} cached={cached}", flush=True)

    by_source: dict[str, list] = defaultdict(list)
    for row in corpus:
        su = row.get("source_uri") or ""
        if source_filter and su not in source_filter:
            continue
        by_source[su].append(row)

    manifest = load_manifest()
    for su, rows in by_source.items():
        if not su:
            continue
        content_hash = rows[0].get("source_content_hash") or ""
        update_source(
            manifest,
            su,
            content_hash=content_hash,
            chunk_count=len(rows),
            embedding_model=model,
            chunk_schema_version=CHUNK_SCHEMA_VERSION,
        )
    save_manifest(manifest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
