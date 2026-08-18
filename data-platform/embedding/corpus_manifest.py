"""Unified corpus ingest / embedding manifest (local dev + bulk worker)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
MANIFEST_PATH = ROOT / "data" / "corpus_manifest.json"
LEGACY_STATE_PATH = ROOT / "data" / ".ingest_state.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_manifest() -> dict[str, Any]:
    if MANIFEST_PATH.is_file():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if LEGACY_STATE_PATH.is_file():
        legacy = json.loads(LEGACY_STATE_PATH.read_text(encoding="utf-8"))
        manifest = {
            "schema_version": 1,
            "embedding_model": "",
            "chunk_schema_version": "",
            "sources": {
                rel: {"content_hash": h, "indexed_at": _now_iso()}
                for rel, h in legacy.items()
            },
        }
        save_manifest(manifest)
        return manifest
    return {
        "schema_version": 1,
        "embedding_model": "",
        "chunk_schema_version": "",
        "sources": {},
    }


def save_manifest(manifest: dict[str, Any]) -> None:
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def get_source(manifest: dict[str, Any], source_uri: str) -> dict[str, Any] | None:
    return manifest.get("sources", {}).get(source_uri)


def update_source(
    manifest: dict[str, Any],
    source_uri: str,
    *,
    content_hash: str,
    document_id: str | None = None,
    chunk_count: int | None = None,
    embedding_model: str | None = None,
    chunk_schema_version: str | None = None,
) -> None:
    entry = manifest.setdefault("sources", {}).setdefault(source_uri, {})
    entry["content_hash"] = content_hash
    entry["indexed_at"] = _now_iso()
    if document_id is not None:
        entry["document_id"] = document_id
    if chunk_count is not None:
        entry["chunk_count"] = chunk_count
    if embedding_model:
        manifest["embedding_model"] = embedding_model
    if chunk_schema_version:
        manifest["chunk_schema_version"] = chunk_schema_version


def source_unchanged(
    manifest: dict[str, Any],
    source_uri: str,
    content_hash: str,
    *,
    embedding_model: str,
    chunk_schema_version: str,
) -> bool:
    entry = get_source(manifest, source_uri)
    if not entry:
        return False
    if manifest.get("embedding_model") != embedding_model:
        return False
    if manifest.get("chunk_schema_version") != chunk_schema_version:
        return False
    return entry.get("content_hash") == content_hash
