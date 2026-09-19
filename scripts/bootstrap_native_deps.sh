#!/usr/bin/env bash
# Install/sync Python deps required by `make native` (editable workspace packages).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -d .venv ]]; then
  echo "Creating .venv …"
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

echo "Installing native stack Python dependencies …"
python -m pip install -q --upgrade pip
python -m pip install -q -e "backend/libs/legalos_common" -e "backend/services/auth"

python - <<'PY'
import importlib

required = ("jinja2", "PIL", "fastapi", "uvicorn")
missing = []
for mod in required:
    try:
        importlib.import_module(mod if mod != "PIL" else "PIL")
    except ImportError:
        missing.append(mod)
if missing:
    raise SystemExit(f"Missing modules after bootstrap: {', '.join(missing)}")
print("Native Python deps OK")
PY
