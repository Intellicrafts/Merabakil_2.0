from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from app.infrastructure.extract import extract_document_text
from legalos_common.clients.storage import LocalFileStorage


def _fake_prepare_image(_data: bytes):
    class FakeImg:
        mode = "RGB"

        def save(self, buf, format="JPEG", quality=90):  # noqa: ANN001, ARG002
            buf.write(b"jpeg")

    return FakeImg()


def test_extract_image_returns_empty_when_all_methods_fail(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.infrastructure.extract as extract_mod

    monkeypatch.setattr(extract_mod, "_prepare_image", _fake_prepare_image)
    monkeypatch.setattr(extract_mod, "describe_image_with_gemini", lambda *args, **kwargs: "")
    monkeypatch.setitem(
        __import__("sys").modules,
        "pytesseract",
        type("M", (), {"image_to_string": staticmethod(lambda _img: "")})(),
    )
    text, pages = extract_document_text(
        b"fake-image-bytes",
        filename="scan.png",
        content_type="image/png",
    )
    assert text == ""
    assert pages == 1


def test_extract_image_with_mocked_ocr(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.infrastructure.extract as extract_mod

    monkeypatch.setattr(extract_mod, "_prepare_image", _fake_prepare_image)
    monkeypatch.setattr(extract_mod, "describe_image_with_gemini", lambda *args, **kwargs: "")
    monkeypatch.setitem(
        __import__("sys").modules,
        "pytesseract",
        type("M", (), {"image_to_string": staticmethod(lambda _img: "Legal notice dated 2024")})(),
    )
    text, pages = extract_document_text(
        b"fake-image-bytes",
        filename="notice.jpg",
        content_type="image/jpeg",
    )
    assert "Legal notice" in text
    assert pages == 1


def test_extract_image_uses_gemini_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.infrastructure.extract as extract_mod

    monkeypatch.setattr(extract_mod, "_prepare_image", _fake_prepare_image)
    monkeypatch.setitem(
        __import__("sys").modules,
        "pytesseract",
        type("M", (), {"image_to_string": staticmethod(lambda _img: "")})(),
    )
    monkeypatch.setattr(
        extract_mod,
        "describe_image_with_gemini",
        lambda *args, **kwargs: "Scanned rental agreement with Rs 50,000 deposit clause",
    )
    text, pages = extract_document_text(
        b"fake-image-bytes",
        filename="lease.jpg",
        content_type="image/jpeg",
    )
    assert "rental agreement" in text
    assert pages == 1


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
