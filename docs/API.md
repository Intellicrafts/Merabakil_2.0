# API Reference (Phase 1)

All services expose OpenAPI docs at `/docs` and a machine-readable schema at
`/openapi.json`. APIs are versioned under `/api/v1`. List endpoints support
`?page=&size=` pagination and return `{items, page, size, total, pages}`.

## Auth Service (`:8001`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/register` | none | Create an account, returns tokens |
| POST | `/api/v1/auth/login` | none | Authenticate, returns tokens |
| POST | `/api/v1/auth/refresh` | none | Rotate refresh token |
| POST | `/api/v1/auth/password-reset` | none | Request reset token |
| POST | `/api/v1/auth/password-reset/confirm` | none | Complete reset |
| GET | `/api/v1/users/me` | Bearer | Current user claims |
| GET | `/api/v1/users` | `user:manage` | List users (paginated) |
| GET | `/api/v1/users/{id}` | `user:manage` | Get a user |

## Knowledge Ingestion Service (`:8002`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/knowledge/documents` | `knowledge:ingest` | Ingest inline text |
| POST | `/api/v1/knowledge/documents/upload` | `knowledge:ingest` | Upload + ingest a file (S3) |
| GET | `/api/v1/knowledge/documents` | `knowledge:ingest` | List documents |
| GET | `/api/v1/knowledge/documents/{id}` | `knowledge:ingest` | Get a document |

## Search Service (`:8003`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/search` | `search:read` | vector / keyword / hybrid search |

## Research Service (`:8004`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/research` | `research:read` | Grounded answer + sources + citations + confidence |

## Example

```bash
# 1. Login (after `make seed`)
TOKEN=$(curl -s localhost:8001/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@legalos.in","password":"ChangeMe!2026"}' | jq -r .tokens.access_token)

# 2. Ingest a document
curl -s localhost:8002/api/v1/knowledge/documents \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Contract Act s.10","doc_type":"central_act","text":"Section 10 ..."}'

# 3. Research
curl -s localhost:8004/api/v1/research \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"query":"What makes an agreement a valid contract?"}'
```
