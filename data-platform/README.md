# data-platform

Batch and streaming data tooling for the legal knowledge corpus.

- `workers/` - long-running ingestion workers (the Phase 1 Kafka ingestion worker
  ships inside `backend/services/knowledge-ingestion/app/worker.py`; heavier batch
  workers land here in Phase 2/3).
- `connectors/` - source connectors for real legal corpora (Supreme Court /
  High Court judgments, gazettes, RBI/SEBI/MCA/GST/DPDP circulars). Phase 3.
- `embedding/` - offline embedding/backfill pipelines and evaluation harnesses.

The embedding/LLM provider abstraction is shared from
`backend/libs/legalos_common/legalos_common/clients/llm.py`.
