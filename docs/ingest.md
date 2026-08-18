# Corpus ingestion guide

How to ingest the Indian legal corpus into MeraBakil / AI Legal OS — full corpus, incremental updates, single files, and native dev embedding cache.

> Implementation note: incremental cache, upsert-by-`source_uri`, and manual re-index APIs are live. See commands below.

## Overview

| Path | When to use | Storage |
|------|-------------|---------|
| **Native dev** (`make native`) | Local development without Docker | In-memory search + disk embedding cache (`data/.embedding_cache/`) |
| **Production / Docker** (`make bulk-ingest`) | Qdrant + OpenSearch + Postgres | Knowledge ingestion service on `:8002` |

Both paths use **content hashes** so only changed documents are re-embedded. Manual re-index can force a single document.

---

## Prerequisites

1. `cp .env.example .env`
2. Gemini keys for real embeddings:
   ```bash
   EMBEDDING_USE_STUB=false
   LLM_USE_STUB=false
   EMBEDDING_API_KEY=<your-key>
   EMBEDDING_MODEL=gemini-embedding-001
   ```
3. Python venv (`make native` / README setup)

**Admin login:** `admin@legalos.in` / `ChangeMe!2026`

---

## Native dev (no Docker)

```bash
make native
```

First run embeds missing chunks into `data/.embedding_cache/`. Later starts load from cache (seconds, not minutes).

### Warm cache without starting servers

```bash
# Full incremental warm
make embed-corpus

# One raw-data file (force re-embed that source)
make embed-corpus SOURCE="Indian_constitution/Indian_constitution.json"
```

Equivalent:

```bash
python backend/scripts/embed_corpus.py
python backend/scripts/embed_corpus.py --source "Indian_constitution/Indian_constitution.json"
```

Manifest: `data/corpus_manifest.json`

---

## Docker / production ingest

```bash
make up && make seed
make bulk-ingest          # incremental (skip unchanged)
```

### Full force rebuild

```bash
python data-platform/workers/bulk_ingest_raw_data.py --force
```

### One specific file

Implies `--force` for that file (unless `--no-force`):

```bash
python data-platform/workers/bulk_ingest_raw_data.py \
  --source "Indian_constitution/Indian_constitution.json"

python data-platform/workers/bulk_ingest_raw_data.py \
  --source "All amendments/AMENDMENTS_2.pdf"
```

Multiple:

```bash
python data-platform/workers/bulk_ingest_raw_data.py \
  --source "Indian_constitution/Indian_constitution.json" \
  --source "All_articels_of_indian_constitution/articles.json"
```

### Dry run / in-process

```bash
python data-platform/workers/bulk_ingest_raw_data.py --dry-run
python data-platform/workers/bulk_ingest_raw_data.py --inprocess
```

---

## HTTP API — manual re-index

Requires `knowledge:ingest` (admin).

### By document ID

```bash
curl -X POST "http://localhost:8002/api/v1/knowledge/documents/{document_id}/reindex?force=true" \
  -H "Authorization: Bearer $TOKEN"
```

### By raw-data source path

```bash
curl -X POST "http://localhost:8002/api/v1/knowledge/sources/reindex" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_uri": "Indian_constitution/Indian_constitution.json", "force": true}'
```

Statuses: `indexed` | `reindexed` | `unchanged`

Structured ingest accepts `force` and `content_hash`:

```bash
POST /api/v1/knowledge/documents/structured
```

---

## Admin UI

**Knowledge Hub** → `/admin/knowledge` → **Corpus** tab → **Re-index** on each document (confirm dialog).

---

## How incremental ingest works

```text
Source file changed?
  ├─ No  → skip (status: unchanged)
  └─ Yes → purge old vectors for document_id
           → re-embed chunks for that document only
           → upsert Qdrant + OpenSearch
           → update corpus_manifest.json (+ native cache)
```

Also invalidates when `EMBEDDING_MODEL` or chunk schema (`1500-100-v1`) changes.

---

## Supported raw-data sources

| Relative path | Type |
|---------------|------|
| `Indian_law_and_supreme_cort/Indian_Law_and_Supreme_Court_Database_2026_NLPRAG.csv` | CSV |
| `Indian_constitution/Indian_constitution.json` | Constitution JSON |
| `All_articels_of_indian_constitution/articles.json` | Articles |
| `All amendments/AMENDMENTS_2.pdf` | PDF |
| `All amendments/AMENDMENTS (1).pdf` | PDF |
| `Repealed Laws /Repealed Laws _1950_to_2014.pdf` | PDF |
| `Repealed Laws /Repealed_Laws1 _2014_to_2026.pdf` | PDF |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Native startup still slow | `make embed-corpus` once; check `data/.embedding_cache/` |
| Stale search after editing raw-data | `make embed-corpus SOURCE="…"` or `bulk-ingest --source "…"` |
| Duplicate corpus docs | Upsert uses `source_uri`; use reindex, don't re-upload same path blindly |
| Port in use | `make stop-native` |
| Embedding API errors | `EMBEDDING_USE_STUB=true` or fix API key |
| Full rebuild | Delete `data/.embedding_cache/` + `data/corpus_manifest.json`, then `--force` |

---

## Quick cheat sheet

```bash
make native
make embed-corpus
make embed-corpus SOURCE="Indian_constitution/Indian_constitution.json"

make up && make seed
make bulk-ingest
python data-platform/workers/bulk_ingest_raw_data.py --force
python data-platform/workers/bulk_ingest_raw_data.py --source "path/under/raw-data"

make stop-native
```
