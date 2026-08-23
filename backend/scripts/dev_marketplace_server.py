#!/usr/bin/env python3
"""Marketplace service — shares the auth PostgreSQL database (same lawyers/users tables)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "backend" / "scripts"))
from dev_bootstrap import bootstrap_dev_env  # noqa: E402

bootstrap_dev_env(_ROOT)

os.environ.setdefault("MARKETPLACE_NATIVE", "true")  # SQLite in native mode (no Postgres)
os.environ.setdefault("MARKETPLACE_AUTO_CONFIRM", "true")

sys.path[:0] = [
    str(_ROOT / "backend" / "libs" / "legalos_common"),
    str(_ROOT / "backend" / "services" / "lawyer-marketplace"),
]

from app.main import app  # noqa: E402

if __name__ == "__main__":
    import uvicorn

    print("Marketplace (native) http://localhost:8010/docs — SQLite data/marketplace.db")
    uvicorn.run(app, host="0.0.0.0", port=8010, log_level="info")
