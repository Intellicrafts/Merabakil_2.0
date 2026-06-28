# Security

## Authentication & authorization

- **JWT** access + refresh tokens (`legalos_common.security.jwt`). Access tokens
  embed `roles` and `permissions` as signed claims so any service can authorize
  requests without a network round-trip. Refresh tokens are rotated on use and
  tracked server-side for revocation.
- **Argon2** password hashing (`passlib[argon2]`).
- **RBAC** via reusable dependencies `require_roles(...)` / `require_permissions(...)`.
  Roles: `admin`, `advocate`, `law_firm`, `enterprise`, `citizen`. The `admin` role
  is a superset.

## Data protection

- **AES-256-GCM** authenticated field encryption (`legalos_common.security.encryption.AESCipher`)
  for sensitive columns. Key supplied via `FIELD_ENCRYPTION_KEY` (32-byte hex).
- **TLS** terminated at the ingress/load balancer in Kubernetes (see `infrastructure/k8s`).
- **Secrets** are provided via environment variables locally and Kubernetes Secrets
  (or External Secrets) in cluster. No secrets are committed; `.env` is gitignored.

## RAG & LLM security

- **Prompt-injection detection** (`legalos_common.rag.guardrails.detect_prompt_injection`)
  runs on user input; suspicious queries are rejected by the Research API (HTTP 422).
- **Input sanitisation** trims length and strips role-tag injection (`<system>` etc.).
- **Grounding**: the reasoning agent is instructed to answer only from numbered
  context and to refuse when context is insufficient, reducing hallucination.
- **Source attribution**: every answer returns retrieved sources, bracketed
  citations, and an explainable confidence breakdown.

## Application security

- **Input validation** via Pydantic models on every endpoint.
- **Rate limiting** (Redis fixed-window) on auth-sensitive endpoints.
- **Unified error model** avoids leaking internals; unhandled exceptions return a
  generic 500.
- **Audit trail**: `audit_logs` table + `audit.log` Kafka topic (consumed by the
  Phase 2 Audit Service) provide traceability with correlation IDs.

## Hardening backlog (Phase 3)

- mTLS between services, OIDC federation, secret rotation, WAF, image scanning,
  SBOM, and per-tenant data isolation.
