#!/usr/bin/env bash
# Run after Docker stack is up: seed admin, ingest raw-data, evaluate RAG.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Seeding admin user and roles..."
make seed

echo ""
echo "==> Bulk ingesting raw-data/ corpus..."
. .venv/bin/activate
python data-platform/workers/bulk_ingest_raw_data.py "$@"

echo ""
echo "==> Running RAG evaluation..."
python backend/scripts/eval_rag.py

echo ""
echo "==> Health check..."
bash scripts/health_check.sh

echo ""
echo "Setup complete. Open http://localhost:3000"
echo "Login: admin@legalos.in / ChangeMe!2026 (change password in production)"
