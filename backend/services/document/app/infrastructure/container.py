"""Shared, long-lived client container with lifecycle management."""

from __future__ import annotations

from pathlib import Path

from app.config import DocumentSettings
from legalos_common.clients import LocalFileStorage, build_storage
from legalos_common.logging import get_logger

logger = get_logger(__name__)


class Container:
    def __init__(self, settings: DocumentSettings) -> None:
        self.settings = settings
        self.storage = self._build_store(settings)

    @staticmethod
    def _build_store(settings: DocumentSettings):
        mode = (settings.document_storage or "auto").lower()
        if mode == "local" or not settings.storage.use_gcs:
            return LocalFileStorage(Path(settings.local_upload_root))
        return build_storage(settings.storage)

    async def startup(self) -> None:
        mode = (self.settings.document_storage or "auto").lower()
        if mode == "local" or not self.settings.storage.use_gcs:
            await self.storage.ensure_bucket()
            logger.info("document_storage_backend", backend="local")
            return
        try:
            await self.storage.ensure_bucket()
            logger.info("document_storage_backend", backend="gcs")
        except Exception as exc:
            if mode == "gcs":
                raise
            logger.warning("gcs_unavailable_using_local_storage error=%s", exc)
            self.storage = LocalFileStorage(Path(self.settings.local_upload_root))
            await self.storage.ensure_bucket()
            logger.info("document_storage_backend", backend="local")

    async def shutdown(self) -> None:
        return None


_container: Container | None = None


def init_container(settings: DocumentSettings) -> Container:
    global _container
    _container = Container(settings)
    return _container


def get_container() -> Container:
    if _container is None:
        raise RuntimeError("Container not initialised")
    return _container
