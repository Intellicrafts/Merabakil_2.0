#!/usr/bin/env python3
"""Bulk-ingest raw-data/ into Qdrant + OpenSearch via the ingestion service.

Supports structure-aware parsers for CSV/JSON and standard PDF pipeline for amendments
and repealed-law documents. Idempotent via content-hash tracking in a local state file.

Usage (from project root, Docker stack running):
  python data-platform/workers/bulk_ingest_raw_data.py
  python data-platform/workers/bulk_ingest_raw_data.py --force
  python data-platform/workers/bulk_ingest_raw_data.py --api-url http://localhost:8002
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "backend" / "scripts"
STATE_FILE = ROOT / "data" / ".ingest_state.json"

sys.path.insert(0, str(SCRIPTS))

from parsers.csv_legal_db import parse_csv_legal_db  # noqa: E402
from parsers.json_articles_dict import parse_json_articles_dict  # noqa: E402
from parsers.json_constitution import article_numbers_from_constitution, parse_json_constitution  # noqa: E402
from parsers.types import ParsedDocument  # noqa: E402

RAW_DATA = ROOT / "raw-data"

SKIP_FILES = {
    "Indian_constitution_hindi.pdf",
    "Indian_constitution_english.pdf",  # prefer structured JSON
}

PRIORITY_SOURCES: list[tuple[str, str]] = [
    ("Indian_law_and_supreme_cort/Indian_Law_and_Supreme_Court_Database_2026_NLPRAG.csv", "csv"),
    ("Indian_constitution/Indian_constitution.json", "constitution_json"),
    ("All_articels_of_indian_constitution/articles.json", "articles_dict"),
    ("All amendments/AMENDMENTS_2.pdf", "pdf"),
    ("All amendments/AMENDMENTS (1).pdf", "pdf"),
    ("Repealed Laws /Repealed Laws _1950_to_2014.pdf", "pdf"),
    ("Repealed Laws /Repealed_Laws1 _2014_to_2026.pdf", "pdf"),
]


def _load_state() -> dict[str, str]:
    if STATE_FILE.is_file():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def _save_state(state: dict[str, str]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2), encoding="utf-8")


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
) -> dict:
    payload = {
        "title": doc.title,
        "doc_type": doc.doc_type,
        "jurisdiction": doc.jurisdiction,
        "content_type": content_type,
        "source_file": doc.source_file,
        "page_count": doc.page_count,
        "citations": [c for c in doc.citations if not c.startswith("dedup_skipped:")],
        "chunks": _to_structured_inputs(doc),
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
    jurisdiction: str = "india",
) -> dict:
    async with httpx.AsyncClient(timeout=600.0) as client:
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


async def _ingest_inprocess(doc: ParsedDocument, content_type: str) -> dict:
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
            source_uri=doc.source_file,
            content_type=content_type,
            page_count=doc.page_count,
            citations=[c for c in doc.citations if not c.startswith("dedup_skipped:")],
        )
        await session.commit()

    await container.shutdown()
    return {
        "document_id": result.document_id,
        "chunk_count": result.chunk_count,
        "status": result.status,
    }


def _resolve_doc_type(rel_path: str, kind: str) -> str:
    if kind == "csv":
        return "legal_database"
    if kind in ("constitution_json", "articles_dict"):
        return "constitution"
    if "amendment" in rel_path.lower():
        return "constitutional_amendment"
    if "repealed" in rel_path.lower():
        return "repealed_statute"
    return "legal_document"


def _build_parsed(rel: str, kind: str, constitution_path: Path | None) -> ParsedDocument | None:
    path = RAW_DATA / rel
    if not path.is_file():
        print(f"  SKIP missing: {rel}")
        return None
    if path.name in SKIP_FILES:
        print(f"  SKIP excluded: {path.name}")
        return None

    if kind == "csv":
        return parse_csv_legal_db(path)
    if kind == "constitution_json":
        return parse_json_constitution(path)
    if kind == "articles_dict":
        existing: set[str] = set()
        if constitution_path and constitution_path.is_file():
            existing = article_numbers_from_constitution(constitution_path)
        return parse_json_articles_dict(path, existing_articles=existing)
    raise ValueError(f"Unknown structured kind: {kind}")


def _host_url(env_val: str, localhost: str) -> str:
    """Map Docker-internal service hostnames to localhost when running on the host."""
    if any(h in env_val for h in ("://auth:", "://knowledge-ingestion:", "://search:", "://research:")):
        return localhost
    return env_val


async def main() -> int:
    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser(description="Bulk ingest raw-data into legal knowledge index")
    parser.add_argument("--force", action="store_true", help="Re-ingest even if content hash unchanged")
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

    state = _load_state()
    token: str | None = None
    if not args.inprocess:
        try:
            token = await _login(args.auth_url, args.email, args.password)
            print(f"Authenticated as {args.email}")
        except Exception as exc:
            print(f"Auth failed ({exc}); falling back to in-process mode")
            args.inprocess = True

    constitution_path = RAW_DATA / "Indian_constitution" / "Indian_constitution.json"
    total_chunks = 0
    ingested = 0
    skipped = 0
    failed = 0

    print(f"\nBulk ingest — raw-data/ → {'in-process' if args.inprocess else args.api_url}\n")

    for rel, kind in PRIORITY_SOURCES:
        path = RAW_DATA / rel
        print(f"→ {rel} ({kind})")

        if kind == "pdf":
            if path.name in SKIP_FILES or not path.is_file():
                print(f"  SKIP")
                skipped += 1
                continue
            content_hash = ParsedDocument.hash_content(path.read_bytes().decode("latin-1", errors="ignore"))
            if not args.force and state.get(rel) == content_hash:
                print("  SKIP unchanged (hash match)")
                skipped += 1
                continue
            if args.dry_run:
                print(f"  DRY-RUN would ingest PDF ({_resolve_doc_type(rel, kind)})")
                ingested += 1
                continue
            try:
                if args.inprocess:
                    print("  PDF in-process not supported; use API mode")
                    failed += 1
                    continue
                assert token
                result = await _ingest_pdf_via_api(
                    api_url=args.api_url,
                    token=token,
                    path=path,
                    doc_type=_resolve_doc_type(rel, kind),
                )
                state[rel] = content_hash
                ingested += 1
                total_chunks += result.get("chunk_count", 0)
                print(f"  OK document_id={result.get('document_id')} chunks={result.get('chunk_count')}")
            except Exception as exc:
                print(f"  FAIL {exc}")
                failed += 1
            continue

        try:
            parsed = _build_parsed(rel, kind, constitution_path)
        except Exception as exc:
            print(f"  PARSE FAIL {exc}")
            failed += 1
            continue

        if parsed is None:
            skipped += 1
            continue

        if not args.force and state.get(rel) == parsed.content_hash:
            print(f"  SKIP unchanged ({len(parsed.chunks)} chunks)")
            skipped += 1
            continue

        if args.dry_run:
            print(f"  DRY-RUN would ingest {len(parsed.chunks)} chunks ({parsed.doc_type})")
            ingested += 1
            total_chunks += len(parsed.chunks)
            continue

        try:
            if args.inprocess:
                result = await _ingest_inprocess(parsed, content_type=f"application/{kind}")
            else:
                assert token
                result = await _ingest_via_api(
                    api_url=args.api_url,
                    token=token,
                    doc=parsed,
                    content_type=f"application/{kind}",
                )
            state[rel] = parsed.content_hash
            ingested += 1
            total_chunks += result.get("chunk_count", len(parsed.chunks))
            print(f"  OK document_id={result.get('document_id')} chunks={result.get('chunk_count', len(parsed.chunks))}")
        except Exception as exc:
            print(f"  FAIL {exc}")
            failed += 1

    _save_state(state)
    print(f"\nDone: ingested={ingested} skipped={skipped} failed={failed} total_chunks≈{total_chunks}\n")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
