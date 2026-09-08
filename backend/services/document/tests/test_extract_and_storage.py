from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.infrastructure.extract import extract_document_text
from legalos_common.clients.storage import LocalFileStorage


def test_extract_plain_text() -> None:
    text, pages = extract_document_text(
        b"Security deposit is Rs 50,000.",
        filename="note.txt",
        content_type="text/plain",
    )
    assert "50,000" in text
    assert pages == 1


def test_local_file_storage_roundtrip(tmp_path: Path) -> None:
    store = LocalFileStorage(tmp_path)

    async def _run() -> None:
        await store.ensure_bucket()
        uri = await store.put_object("documents/abc/note.txt", b"hello", content_type="text/plain")
        assert uri.startswith("file://")
        data = await store.get_object("documents/abc/note.txt")
        assert data == b"hello"

    asyncio.run(_run())


def test_local_storage_rejects_path_escape(tmp_path: Path) -> None:
    store = LocalFileStorage(tmp_path)
    with pytest.raises(ValueError):
        store._path("../etc/passwd")


def test_auto_storage_falls_back_to_local(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import DocumentSettings
    from app.infrastructure.container import Container
    from legalos_common.clients.s3 import S3Storage

    async def _fail_bucket(self) -> None:  # noqa: ARG001
        raise ConnectionError("minio down")

    monkeypatch.setattr(S3Storage, "ensure_bucket", _fail_bucket)
    settings = DocumentSettings(
        document_storage="auto",
        local_upload_root=str(tmp_path),
        kafka_bootstrap_servers="localhost:9092",
        ingestion_service_url="http://localhost:8002",
        use_kafka_ingestion=False,
    )
    container = Container(settings)

    async def _run() -> None:
        await container.startup()
        assert isinstance(container.s3, LocalFileStorage)
        uri = await container.s3.put_object("documents/x/note.txt", b"ok", content_type="text/plain")
        assert uri.startswith("file://")

    asyncio.run(_run())
