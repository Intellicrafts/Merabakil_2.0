"""Object storage port: MinIO/S3 or local filesystem."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Protocol

from legalos_common.logging import get_logger

logger = get_logger(__name__)


class ObjectStore(Protocol):
    async def ensure_bucket(self) -> None: ...

    async def put_object(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str: ...

    async def get_object(self, key: str) -> bytes: ...


class LocalFileStorage:
    """Writes objects under a project data directory (native / offline fallback)."""

    def __init__(self, root: str | Path) -> None:
        self._root = Path(root)

    @property
    def root(self) -> Path:
        return self._root

    async def ensure_bucket(self) -> None:
        await asyncio.to_thread(self._root.mkdir, parents=True, exist_ok=True)
        logger.info("local_storage_ready", path=str(self._root.resolve()))

    def _path(self, key: str) -> Path:
        safe = Path(key)
        if safe.is_absolute() or ".." in safe.parts:
            raise ValueError("invalid storage key")
        return self._root / safe

    async def put_object(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        path = self._path(key)

        def _write() -> str:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            return f"file://{path.resolve()}"

        return await asyncio.to_thread(_write)

    async def get_object(self, key: str) -> bytes:
        path = self._path(key)

        def _read() -> bytes:
            if not path.is_file():
                raise FileNotFoundError(key)
            return path.read_bytes()

        return await asyncio.to_thread(_read)
