#!/usr/bin/env bash
# Run each Phase 1 test suite in its own pytest process. Service test packages
# share the name "tests", so they must be collected separately to avoid import
# collisions - this mirrors standard polyrepo-style isolation in a monorepo.
set -euo pipefail

cd "$(dirname "$0")/.."

COMMON="libs/legalos_common"
ORCH="orchestrator"

declare -a SUITES=(
  "libs/legalos_common/tests|${COMMON}"
  "orchestrator/tests|${COMMON}:${ORCH}"
  "services/auth/tests|${COMMON}:services/auth"
  "services/knowledge-ingestion/tests|${COMMON}:services/knowledge-ingestion"
  "services/search/tests|${COMMON}:services/search"
  "services/research/tests|${COMMON}:${ORCH}:services/research"
)

failed=0
for entry in "${SUITES[@]}"; do
  path="${entry%%|*}"
  pythonpath="${entry##*|}"
  echo "==> pytest ${path}"
  if ! PYTHONPATH="${pythonpath}" python -m pytest "${path}" -q -p no:cacheprovider; then
    failed=1
  fi
done

exit "${failed}"
