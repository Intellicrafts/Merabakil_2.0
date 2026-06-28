from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class DocumentSettings(CommonSettings):
    service_name: str = "document-service"
    use_kafka_ingestion: bool = True


@lru_cache
def get_settings() -> DocumentSettings:
    return DocumentSettings()
