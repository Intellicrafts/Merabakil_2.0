# audit service (Phase 2)

Status: planned for Phase 2. The platform database schema for this domain is
already provisioned in the Phase 1 baseline migration
(`backend/services/auth/migrations/versions/0001_initial_platform_schema.py`).

Responsibilities: Audit logs, traceability, compliance logs.

This service will follow the same Clean Architecture layering as the Phase 1
services (`domain` / `application` / `infrastructure` / `api`), reuse
`legalos_common`, and integrate via Kafka event contracts. See
`docs/ROADMAP.md`.
