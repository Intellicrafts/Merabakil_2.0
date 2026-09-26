"""Load a corpus JSONL (from build_statute_corpus.py) into the knowledge base.

Runs inside the ingestion container, where the JWT secret and the service are
available. Every document is posted to the structured-ingestion endpoint, which
embeds it and indexes it as public corpus. Idempotent: an unchanged document
(same source_file + content hash) is skipped by the service.

  docker compose … cp corpus.jsonl ingestion:/tmp/corpus.jsonl
  docker compose … cp backend/scripts/load_corpus.py ingestion:/tmp/load_corpus.py
  docker compose … exec ingestion python /tmp/load_corpus.py /tmp/corpus.jsonl
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import uuid
from pathlib import Path

import httpx

from legalos_common.security.jwt import create_access_token

# Fixed identity recorded as owner of the public corpus documents.
LOADER_ID = str(uuid.uuid5(uuid.NAMESPACE_URL, "https://merabakil.in/saarthi/corpus-loader"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("jsonl", type=Path)
    parser.add_argument("--url", default="http://localhost:8000/api/v1/knowledge/documents/structured")
    parser.add_argument("--force", action="store_true", help="re-embed even if unchanged")
    parser.add_argument("--manifest", type=Path, default=Path("/tmp/corpus_load_manifest.json"))
    args = parser.parse_args()

    token = create_access_token(LOADER_ID, roles=["admin"], permissions=["knowledge:ingest"])
    headers = {"Authorization": f"Bearer {token}"}
    results: list[dict] = []
    failures = 0

    with httpx.Client(timeout=900.0) as client, args.jsonl.open(encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, 1):
            doc = json.loads(line)
            doc["force"] = args.force
            started = time.monotonic()
            try:
                resp = client.post(args.url, json=doc, headers=headers)
                resp.raise_for_status()
                body = resp.json()
                status = body.get("status")
                results.append({"title": doc["title"], "status": status, "chunks": body.get("chunk_count")})
                print(f"[{line_no}] {status:<10} {doc['title']} ({len(doc['chunks'])} chunks, "
                      f"{time.monotonic() - started:.0f}s)", flush=True)
            except httpx.HTTPError as exc:
                failures += 1
                detail = getattr(getattr(exc, "response", None), "text", "")[:300]
                results.append({"title": doc["title"], "status": "failed", "error": detail or str(exc)})
                print(f"[{line_no}] FAILED     {doc['title']}: {detail or exc}", flush=True)

    args.manifest.write_text(json.dumps(results, indent=2, ensure_ascii=False))
    print(f"\n{len(results) - failures} loaded, {failures} failed — manifest: {args.manifest}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
