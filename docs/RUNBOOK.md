# Runbook

## Local development (docker-compose)

```bash
cp .env.example .env       # default config runs fully offline (LLM_USE_STUB=true)
make up                    # build + start infra, services and frontend
make seed                  # default roles/permissions + admin@legalos.in / ChangeMe!2026
make logs                  # tail logs
make ps                    # service status
make down                  # stop
make clean                 # stop + remove volumes
```

Endpoints:

- Frontend: http://localhost:3000
- Auth docs: http://localhost:8001/docs
- Ingestion docs: http://localhost:8002/docs
- Search docs: http://localhost:8003/docs
- Research docs: http://localhost:8004/docs
- Document docs: http://localhost:8005/docs
- Reasoning docs: http://localhost:8006/docs
- Drafting docs: http://localhost:8007/docs
- Contract review docs: http://localhost:8008/docs
- Litigation docs: http://localhost:8009/docs
- MinIO console: http://localhost:9001
- Neo4j browser: http://localhost:7474

## Tests & quality

```bash
make test     # all backend suites (isolated per service)
make lint     # ruff + mypy
make fmt      # ruff format
```

## Database migrations

Migrations live in `backend/services/auth/migrations` and define the full platform
baseline. The auth container runs `alembic upgrade head` automatically when
`RUN_MIGRATIONS=true`. To run manually: `make migrate`.

## Enabling real LLM/embeddings

Set in `.env`:

```
LLM_USE_STUB=false
LLM_API_KEY=...
EMBEDDING_API_KEY=...
EMBEDDING_DIM=1536   # must match the embedding model; recreate the Qdrant collection if changed
```

## Common issues

- **Qdrant dimension mismatch**: if you change `EMBEDDING_DIM`, drop and recreate
  the collection (`make clean` removes the volume).
- **Kafka not ready**: ingestion falls back to a null event publisher and still
  serves synchronous ingestion; the worker retries on reconnect.
- **OpenSearch memory**: lower `OPENSEARCH_JAVA_OPTS` if the container OOMs.

## Production deployment in India

- **Data residency**: deploy Postgres, MinIO/S3, Qdrant, and Redis in `ap-south-1` (Mumbai) or your preferred Indian region.
- **Object storage**: use AWS S3 with `S3_REGION=ap-south-1`; set `S3_ENDPOINT_URL` empty for native S3.
- **LLM options**: use an India-accessible OpenAI-compatible endpoint or on-prem model; set `LLM_USE_STUB=false` only after keys are configured.
- **Kubernetes**: apply `infrastructure/k8s/` manifests and Helm chart; mount `corpus_registry.yaml` via ConfigMap (`CORPUS_REGISTRY_PATH=/app/data/corpus_registry.yaml`).
- **Scaling**: HPA templates in Helm target search and research services; tune CPU/memory per tenant load.
- **Admin corpus training**: use `/admin/knowledge` in the frontend to upload PDFs by category; async jobs poll `GET /api/v1/knowledge/jobs/{job_id}`.
- **DPDP**: ensure field encryption (`FIELD_ENCRYPTION_KEY`), audit logs, and data-processing agreements before enterprise rollout.
