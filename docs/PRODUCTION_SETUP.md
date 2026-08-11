# Production Setup Guide

## 1. Fix Docker access (one-time)

```bash
bash scripts/setup_docker.sh
newgrp docker   # or log out and back in
```

If `make up` still fails, verify:

```bash
docker ps
```

## 2. Start full stack + ingest corpus

```bash
bash scripts/run_production_stack.sh
```

This runs: `make up` → `make seed` → bulk ingest of `raw-data/` → RAG eval → health check.

### Manual steps

```bash
make up
make seed
make bulk-ingest
make eval-rag
make health
```

## 3. Access the application

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Auth API | http://localhost:8001/docs |
| Ingestion API | http://localhost:8002/docs |
| Search API | http://localhost:8003/docs |
| Research API | http://localhost:8004/docs |

**Default login:** `admin@legalos.in` / `ChangeMe!2026`

## 4. Read-aloud (Mera Vakil)

1. Open http://localhost:3000/mera-vakil
2. Ask a legal question
3. Click **Read Aloud** on the answer

Requires `LLM_USE_STUB=false` and valid Gemini API key with TTS access (`TTS_MODEL`, `TTS_VOICE` in `.env`).

## 5. Re-ingest after adding new files to raw-data/

```bash
# Drop new PDFs/JSON into raw-data/ subfolders, then:
make bulk-ingest

# Force full re-index:
make bulk-ingest -- --force
```

## 6. Production hardening checklist

- [ ] Change `SEED_ADMIN_PASSWORD` in `.env` before `make seed`
- [ ] Rotate `LLM_API_KEY` / `EMBEDDING_API_KEY` — never commit `.env`
- [ ] Set strong `JWT_SECRET_KEY` and `FIELD_ENCRYPTION_KEY`
- [ ] Run `make health` after every deploy
- [ ] Run `make eval-rag` to verify retrieval quality

## Corpus summary (English, raw-data/)

| Source | Chunks (approx) |
|--------|-----------------|
| NLPRAG CSV | 373 |
| Constitution JSON | 598 |
| Articles dict (deduped) | ~2 |
| Amendment PDFs | varies |
| Repealed laws PDFs | varies |

**Total:** ~973+ structured chunks before PDF extraction.
