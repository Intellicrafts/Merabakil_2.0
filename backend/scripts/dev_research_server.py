#!/usr/bin/env python3
"""Research service — dev mode (calls Search at localhost:8003)."""
from __future__ import annotations

import os
import sys

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path[:0] = [
    os.path.join(_ROOT, "backend", "libs", "legalos_common"),
    os.path.join(_ROOT, "backend", "orchestrator"),
    os.path.join(_ROOT, "backend", "services", "research"),
]

os.environ.setdefault("LLM_USE_STUB", "true")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")
os.environ.setdefault("JWT_SECRET_KEY", "dev-local-secret")
os.environ.setdefault("SEARCH_SERVICE_URL", "http://localhost:8003")
os.environ.setdefault(
    "FIELD_ENCRYPTION_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
)

from app.infrastructure.container import init_container  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402

init_container(get_settings())

if __name__ == "__main__":
    import uvicorn

    print("Research (dev) http://localhost:8004/docs")
    uvicorn.run(app, host="0.0.0.0", port=8004, log_level="info")
