# Roadmap

## Phase 1 (delivered)

Runnable vertical slice booting via docker-compose:

- Shared library (`legalos_common`): config, logging, OTel, JWT/RBAC, AES-256,
  pagination, errors, Kafka, Qdrant/Neo4j/OpenSearch/S3/LLM clients, RAG utilities.
- PostgreSQL baseline schema + Alembic migration for all core tables.
- Auth Service (register/login/refresh/reset/RBAC) - tested.
- Knowledge Ingestion Service + worker (parse/OCR/clean/chunk/embed/index/graph/store) - tested.
- Search Service (vector + keyword + hybrid RRF + re-rank) - tested.
- Research Service + LangGraph orchestrator (intent/jurisdiction/research/reasoning,
  confidence, citations) - tested.
- Next.js research console (login + grounded answers with sources/citations/confidence).
- Docker images, docker-compose, GitHub Actions CI.

## Phase 2 (next)

Build out the remaining microservices, each following the same Clean Architecture
layering and event contracts:

- **Case Service** - cases, notes, tasks, timelines (tables already provisioned).
- **Document Service** - upload/OCR/metadata lifecycle distinct from knowledge corpus.
- **Reasoning Service** - apply-law-to-facts, risk/strength analysis.
- **Litigation Service** - procedures, filing guidance, strategy.
- **Drafting Service** - notices, petitions, contracts, replies (templates table).
- **Contract Review Service** - clause extraction, missing-clause + risk analysis.
- **Compliance Service** - RBI/SEBI/MCA/GST/Labour/DPDP.
- **Lawyer Marketplace Service** - profiles, matching, consultations, ratings.
- **Billing Service** - plans, subscriptions, payments, invoices.
- **Audit Service** - consumes `audit.log`, provides traceability/compliance logs.

Agents wired into the orchestrator: Reasoning, Litigation, Drafting, Contract
Review, Evidence, Compliance, Lawyer Matching (typed stubs exist today).

## Phase 3 (hardening & scale)

- Kubernetes manifests + Helm chart hardening (HPA, PodDisruptionBudgets, network
  policies), External Secrets, mTLS.
- Full observability: Prometheus metrics, Grafana dashboards, OTel traces.
- E2E (Playwright) + load tests; data-corpus ingestion connectors for real sources.
