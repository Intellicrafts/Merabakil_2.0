"""Shared environment bootstrap for native dev servers."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


def bootstrap_dev_env(root: Path | None = None) -> Path:
    """Load .env and normalize settings for host-side native stack."""
    base = root or Path(__file__).resolve().parents[2]
    load_dotenv(base / ".env")

    os.environ["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "dev-local-secret")
    os.environ.setdefault(
        "FIELD_ENCRYPTION_KEY",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    )
    os.environ.setdefault("OTEL_SDK_DISABLED", "true")
    os.environ["SEARCH_SERVICE_URL"] = "http://localhost:8003"
    os.environ["AUTH_SERVICE_URL"] = "http://localhost:8001"
    os.environ["RESEARCH_SERVICE_URL"] = "http://localhost:8004"

    return base
