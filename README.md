# AI Legal Operating System for India

An AI-native legal operating system for Citizens, Advocates, Law Firms, and Enterprises.

This is **not** a chatbot. It is a modular, event-driven, microservices platform that
provides legal research, reasoning, drafting, contract review, compliance, document
intelligence, a lawyer marketplace, case management, and knowledge management - all
grounded in retrieval-augmented generation (RAG) with full citation and source
attribution.

## Architecture

- **Clean Architecture / DDD** per service (`domain`, `application`, `infrastructure`, `api`).
- **Event-Driven** integration over Kafka.
- **Microservices** - each independently deployable.
- **CQRS** where useful, Repository + Service Layer patterns throughout.

```
frontend/         Next.js + TypeScript + Tailwind + ShadCN + React Query
backend/
  libs/           Shared Python library (legalos_common)
  services/       FastAPI microservices
  orchestrator/   LangGraph multi-agent orchestrator
data-platform/    Ingestion workers, connectors, embedding pipeline
data/             Legal corpus tree (constitution, acts, judgments, ...)
infrastructure/   Docker, Kubernetes, Helm, monitoring
docs/             Architecture, security, API, runbooks
```

## Phase 1 (this repository, runnable)

A complete, bootable vertical slice plus Phase 2 core legal services:

- **Auth Service** - register, login, refresh, password reset, RBAC.
- **Knowledge Ingestion Service** - PDF parse, OCR, clean, metadata, chunk, embed, index (Qdrant), graph (Neo4j), store (S3/MinIO). Admin categories API + async jobs.
- **Search Service** - vector + keyword + hybrid (RRF) + re-ranking with Redis cache.
- **Research Service** - answers with retrieved sources, citations, confidence; document-scoped Q&A.
- **Document / Reasoning / Drafting / Contract Review / Litigation** - Phase 2 core legal microservices (ports 8005-8009).
- **Orchestrator** - LangGraph multi-agent flow with specialist service integration.
- **Frontend** - premium UI: research console, document Q&A, admin knowledge hub.

### Quick start

```bash
cp .env.example .env
make up          # boots all infra + services + frontend via docker-compose
make seed        # creates default roles, permissions, and an admin user
```

Then open:

- Frontend: http://localhost:3000
- Auth API docs: http://localhost:8001/docs
- Ingestion API docs: http://localhost:8002/docs
- Search API docs: http://localhost:8003/docs
- Research API docs: http://localhost:8004/docs

## Roadmap

- **Phase 2** - Case, Document, Reasoning, Litigation, Drafting, Contract Review, Compliance, Lawyer Marketplace, Billing, Audit services + remaining agents.
- **Phase 3** - Kubernetes/Helm hardening, full observability, E2E + load tests, real corpus connectors.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/SECURITY.md](docs/SECURITY.md).
