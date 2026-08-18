#!/usr/bin/env python3
"""Bulk-ingest raw-data/ into Qdrant + OpenSearch via the ingestion service.

Incremental by content hash. Supports full sweep, --force rebuild, and --source
for a single file.

Usage (from project root, Docker stack running):
  python data-platform/workers/bulk_ingest_raw_data.py
  python data-platform/workers/bulk_ingest_raw_data.py --force
  python data-platform/workers/bulk_ingest_raw_data.py --source "Indian_constitution/Indian_constitution.json"
  python data-platform/workers/bulk_ingest_raw_data.py --api-url http://localhost:8002
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "backend" / "scripts"
sys.path.insert(0, str(ROOT / "data-platform"))
sys.path.insert(0, str(SCRIPTS))

from corpus_sources import (  # noqa: E402
    CHUNK_SCHEMA_VERSION,
    RAW_DATA,
    SKIP_FILES,
    list_sources,
    parse_source,
)
from embedding.corpus_manifest import (  # noqa: E402
    load_manifest,
    save_manifest,
    source_unchanged,
    update_source,
)
from parsers.types import ParsedDocument  # noqa: E402


def _to_structured_inputs(doc: ParsedDocument) -> list[dict]:
    return [
        {
            "content": c.content,
            "title": c.title,
            "section": c.section,
            "citation": c.citation,
            "metadata": c.metadata,
        }
        for c in doc.chunks
    ]


async def _login(auth_url: str, email: str, password: str) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{auth_url}/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def _ingest_via_api(
    *,
    api_url: str,
    token: str,
    doc: ParsedDocument,
    content_type: str,
    source_uri: str,
    force: bool,
) -> dict:
    payload = {
        "title": doc.title,
        "doc_type": doc.doc_type,
        "jurisdiction": doc.jurisdiction,
        "content_type": content_type,
        "source_file": source_uri,
        "page_count": doc.page_count,
        "citations": [c for c in doc.citations if not c.startswith("dedup_skipped:")],
        "chunks": _to_structured_inputs(doc),
        "content_hash": doc.content_hash,
        "force": force,
    }
    async with httpx.AsyncClient(timeout=600.0) as client:
        resp = await client.post(
            f"{api_url}/api/v1/knowledge/documents/structured",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def _ingest_pdf_via_api(
    *,
    api_url: str,
    token: str,
    path: Path,
    doc_type: str,
    source_uri: str,
    jurisdiction: str = "india",
) -> dict:
    # Prefer sources/reindex when forcing a known corpus PDF; otherwise upload.
    async with httpx.AsyncClient(timeout=600.0) as client:
        # Try dedicated reindex endpoint first (keeps stable source_uri)
        reindex = await client.post(
            f"{api_url}/api/v1/knowledge/sources/reindex",
            headers={"Authorization": f"Bearer {token}"},
            json={"source_uri": source_uri, "force": True},
        )
        if reindex.status_code < 400:
            return reindex.json()
        with path.open("rb") as fh:
            resp = await client.post(
                f"{api_url}/api/v1/knowledge/documents/upload",
                headers={"Authorization": f"Bearer {token}"},
                data={
                    "title": path.stem.replace("_", " "),
                    "doc_type": doc_type,
                    "jurisdiction": jurisdiction,
                    "async_mode": "false",
                },
                files={"file": (path.name, fh, "application/pdf")},
            )
        resp.raise_for_status()
        return resp.json()


async def _ingest_inprocess(
    doc: ParsedDocument,
    content_type: str,
    *,
    source_uri: str,
    force: bool,
) -> dict:
    sys.path[:0] = [
        str(ROOT / "backend" / "libs" / "legalos_common"),
        str(ROOT / "backend" / "services" / "knowledge-ingestion"),
    ]
    from app.application.ports import StructuredChunkInput  # noqa: E402
    from app.application.use_cases import IngestDocumentUseCase  # noqa: E402
    from app.config import get_settings  # noqa: E402
    from app.infrastructure.container import init_container  # noqa: E402
    from app.infrastructure.db import session_manager  # noqa: E402
    from app.infrastructure.repositories import DocumentRepository  # noqa: E402

    settings = get_settings()
    os.environ.setdefault("POSTGRES_HOST", "localhost")
    os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
    os.environ.setdefault("OPENSEARCH_URL", "http://localhost:9200")
    os.environ.setdefault("NEO4J_URI", "bolt://localhost:7687")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
    os.environ.setdefault("S3_ENDPOINT_URL", "http://localhost:9000")

    container = init_container(settings)
    await container.startup()

    structured = [
        StructuredChunkInput(
            content=c.content,
            title=c.title,
            section=c.section,
            citation=c.citation,
            metadata=c.metadata,
        )
        for c in doc.chunks
    ]

    async with session_manager.session() as session:
        use_case = IngestDocumentUseCase(
            documents=DocumentRepository(session),
            embedder=container.embedder,
            index=container.indexer,
            events=container.events,
            settings=settings,
        )
        result = await use_case.execute_structured(
            title=doc.title,
            doc_type=doc.doc_type,
            jurisdiction=doc.jurisdiction,
            structured_chunks=structured,
            source_uri=source_uri,
            content_type=content_type,
            page_count=doc.page_count,
            citations=[c for c in doc.citations if not c.startswith("dedup_skipped:")],
            content_hash=doc.content_hash,
            force=force,
        )
        await session.commit()

    await container.shutdown()
    return {
        "document_id": result.document_id,
        "chunk_count": result.chunk_count,
        "status": result.status,
        "chunks_embedded": result.chunks_embedded,
    }


def _host_url(env_val: str, localhost: str) -> str:
    if any(h in env_val for h in ("://auth:", "://knowledge-ingestion:", "://search:", "://research:")):
        return localhost
    return env_val


async def main() -> int:
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser(description="Bulk ingest raw-data into legal knowledge index")
    parser.add_argument("--force", action="store_true", help="Re-ingest even if content hash unchanged")
    parser.add_argument(
        "--no-force",
        action="store_true",
        help="With --source, do not force (skip if unchanged)",
    )
    parser.add_argument(
        "--source",
        action="append",
        dest="sources",
        default=[],
        help="raw-data relative path (repeatable). Implies --force unless --no-force.",
    )
    parser.add_argument(
        "--api-url",
        default=_host_url(os.getenv("INGESTION_SERVICE_URL", "http://localhost:8002"), "http://localhost:8002"),
    )
    parser.add_argument(
        "--auth-url",
        default=_host_url(os.getenv("AUTH_SERVICE_URL", "http://localhost:8001"), "http://localhost:8001"),
    )
    parser.add_argument("--email", default=os.getenv("SEED_ADMIN_EMAIL", "admin@legalos.in"))
    parser.add_argument("--password", default=os.getenv("SEED_ADMIN_PASSWORD", "ChangeMe!2026"))
    parser.add_argument("--inprocess", action="store_true", help="Run ingestion in-process (no HTTP)")
    parser.add_argument("--dry-run", action="store_true", help="Parse only; do not ingest")
    args = parser.parse_args()

    force = args.force or (bool(args.sources) and not args.no_force)
    embedding_model = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")
    if os.getenv("EMBEDDING_USE_STUB", "").lower() in {"1", "true", "yes"}:
        embedding_model = "stub"

    sources = list_sources(args.sources or None)
    if args.sources and not sources:
        print(f"No matching sources for: {args.sources}")
        return 1

    manifest = load_manifest()
    token: str | None = None
    if not args.inprocess:
        try:
            token = await _login(args.auth_url, args.email, args.password)
            print(f"Authenticated as {args.email}")
        except Exception as exc:
            print(f"Auth failed ({exc}); falling back to in-process mode")
            args.inprocess = True

    total_chunks = 0
    ingested = 0
    skipped = 0
    failed = 0
    unchanged = 0

    print(f"\nBulk ingest — raw-data/ → {'in-process' if args.inprocess else args.api_url}")
    print(f"  force={force} sources={len(sources)}\n")

    for rel, kind, doc_type in sources:
        path = RAW_DATA / rel
        print(f"→ {rel} ({kind})")

        if not path.is_file() or path.name in SKIP_FILES:
            print("  SKIP missing/excluded")
            skipped += 1
            continue

        if kind == "pdf":
            content_hash = ParsedDocument.hash_content(
                path.read_bytes().decode("latin-1", errors="ignore")
            )
            if not force and source_unchanged(
                manifest,
                rel,
                content_hash,
                embedding_model=embedding_model,
                chunk_schema_version=CHUNK_SCHEMA_VERSION,
            ):
                print("  SKIP unchanged (hash match)")
                unchanged += 1
                continue
            if args.dry_run:
                print(f"  DRY-RUN would ingest PDF ({doc_type})")
                ingested += 1
                continue
            try:
                if args.inprocess:
                    print("  PDF in-process: use API reindex path via parse_source")
                    parsed = parse_source(rel)
                    if parsed is None:
                        failed += 1
                        continue
                    # In-process PDF as text chunks from parse_source
                    result = await _ingest_inprocess(
                        parsed,
                        content_type="application/pdf",
                        source_uri=rel,
                        force=force,
                    )
                else:
                    assert token
                    result = await _ingest_pdf_via_api(
                        api_url=args.api_url,
                        token=token,
                        path=path,
                        doc_type=doc_type,
                        source_uri=rel,
                    )
                status = result.get("status", "indexed")
                if status == "unchanged":
                    unchanged += 1
                    print("  UNCHANGED")
                else:
                    ingested += 1
                    total_chunks += result.get("chunk_count", 0)
                    print(
                        f"  OK status={status} document_id={result.get('document_id')} "
                        f"chunks={result.get('chunk_count')}"
                    )
                update_source(
                    manifest,
                    rel,
                    content_hash=content_hash,
                    document_id=result.get("document_id"),
                    chunk_count=result.get("chunk_count"),
                    embedding_model=embedding_model,
                    chunk_schema_version=CHUNK_SCHEMA_VERSION,
                )
            except Exception as exc:
                print(f"  FAIL {exc}")
                failed += 1
            continue

        try:
            parsed = parse_source(rel)
        except Exception as exc:
            print(f"  PARSE FAIL {exc}")
            failed += 1
            continue

        if parsed is None:
            skipped += 1
            continue

        if not force and source_unchanged(
            manifest,
            rel,
            parsed.content_hash,
            embedding_model=embedding_model,
            chunk_schema_version=CHUNK_SCHEMA_VERSION,
        ):
            print(f"  SKIP unchanged ({len(parsed.chunks)} chunks)")
            unchanged += 1
            continue

        if args.dry_run:
            print(f"  DRY-RUN would ingest {len(parsed.chunks)} chunks ({parsed.doc_type})")
            ingested += 1
            total_chunks += len(parsed.chunks)
            continue

        try:
            if args.inprocess:
                result = await _ingest_inprocess(
                    parsed,
                    content_type=f"application/{kind}",
                    source_uri=rel,
                    force=force,
                )
            else:
                assert token
                result = await _ingest_via_api(
                    api_url=args.api_url,
                    token=token,
                    doc=parsed,
                    content_type=f"application/{kind}",
                    source_uri=rel,
                    force=force,
                )
            status = result.get("status", "indexed")
            if status == "unchanged":
                unchanged += 1
                print("  UNCHANGED")
            else:
                ingested += 1
                total_chunks += result.get("chunk_count", len(parsed.chunks))
                print(
                    f"  OK status={status} document_id={result.get('document_id')} "
                    f"chunks={result.get('chunk_count', len(parsed.chunks))}"
                )
            update_source(
                manifest,
                rel,
                content_hash=parsed.content_hash,
                document_id=result.get("document_id"),
                chunk_count=result.get("chunk_count", len(parsed.chunks)),
                embedding_model=embedding_model,
                chunk_schema_version=CHUNK_SCHEMA_VERSION,
            )
        except Exception as exc:
            print(f"  FAIL {exc}")
            failed += 1

    save_manifest(manifest)
    print(
        f"\nDone: ingested={ingested} unchanged={unchanged} skipped={skipped} "
        f"failed={failed} total_chunks≈{total_chunks}\n"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
