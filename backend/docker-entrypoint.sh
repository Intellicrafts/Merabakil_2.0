#!/usr/bin/env bash
set -euo pipefail

# Optionally apply database migrations before booting (set RUN_MIGRATIONS=true).
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "[entrypoint] applying database migrations..."
  alembic upgrade head
fi

exec "$@"
