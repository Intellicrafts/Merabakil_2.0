#!/usr/bin/env python3
"""Document service — native mode (local disk + SQLite, no MinIO/Postgres)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "backend" / "scripts"))
from dev_bootstrap import bootstrap_dev_env  # noqa: E402

bootstrap_dev_env(_ROOT)

os.environ["DOCUMENT_STORAGE"] = "local"
os.environ.setdefault("LOCAL_UPLOAD_ROOT", str(_ROOT / "data" / "uploads"))
os.environ["INGESTION_SERVICE_URL"] = "http://localhost:8002"

sys.path[:0] = [
    str(_ROOT / "backend" / "libs" / "legalos_common"),
    str(_ROOT / "backend" / "services" / "document"),
]

from app.api.deps import get_document_repository  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.infrastructure.container import init_container  # noqa: E402
from app.infrastructure.db import get_session  # noqa: E402
from app.infrastructure.sqlite_repo import SqliteDocumentRepository  # noqa: E402
from app.main import app  # noqa: E402

settings = get_settings()
init_container(settings)

_repo = SqliteDocumentRepository(_ROOT / "data" / "documents.db")


async def _noop_session():
    class _Sess:
        async def flush(self) -> None:
            return None

        async def commit(self) -> None:
            return None

    yield _Sess()


app.dependency_overrides[get_session] = _noop_session
app.dependency_overrides[get_document_repository] = lambda: _repo

if __name__ == "__main__":
    import uvicorn

    print("Document (native) http://localhost:8005/docs — local storage data/uploads")
    uvicorn.run(app, host="0.0.0.0", port=8005, log_level="info")
