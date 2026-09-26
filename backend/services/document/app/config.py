from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class DocumentSettings(CommonSettings):
    service_name: str = "document-service"
    document_storage: str = "auto"  # auto | gcs | local
    local_upload_root: str = "data/uploads"
    max_upload_bytes: int = 15 * 1024 * 1024


@lru_cache
def get_settings() -> DocumentSettings:
    return DocumentSettings()
