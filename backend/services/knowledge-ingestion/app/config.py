from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class IngestionSettings(CommonSettings):
    service_name: str = "knowledge-ingestion-service"
    # Parent-child chunking (matches shared codebase)
    parent_chunk_size: int = 1024  # chars — full context stored in parents collection
    child_chunk_size: int = 256   # chars — small excerpt embedded and searched
    child_chunk_overlap: int = 32  # chars — overlap between adjacent children
    # Legacy flat chunking (used by execute_structured only)
    chunk_size: int = 1500
    chunk_overlap: int = 100
    enable_ocr: bool = True
    consumer_group: str = "knowledge-ingestion"
    embedding_batch_size: int = 32
    async_upload_threshold_bytes: int = 2_097_152


@lru_cache
def get_settings() -> IngestionSettings:
    return IngestionSettings()
