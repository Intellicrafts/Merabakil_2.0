"""Centralised, typed configuration loaded from the environment.

Each settings group is a self-contained pydantic-settings model so services can
compose only the configuration they need. Values are read from environment
variables (and optionally a local ``.env`` file during development).
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BASE_CONFIG = SettingsConfigDict(
    env_file=".env",
    env_file_encoding="utf-8",
    extra="ignore",
    case_sensitive=False,
)


class PostgresSettings(BaseSettings):
    model_config = _BASE_CONFIG

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "legalos"
    postgres_password: str = "legalos"
    postgres_db: str = "legalos"

    def dsn(self, *, async_driver: bool = True) -> str:
        driver = "postgresql+asyncpg" if async_driver else "postgresql+psycopg"
        return (
            f"{driver}://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


class SecuritySettings(BaseSettings):
    model_config = _BASE_CONFIG

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_minutes: int = 43_200
    field_encryption_key: str = "0" * 64  # 32 bytes hex


class QdrantSettings(BaseSettings):
    model_config = _BASE_CONFIG

    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "legal_knowledge"


class Neo4jSettings(BaseSettings):
    model_config = _BASE_CONFIG

    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "neo4j"


class OpenSearchSettings(BaseSettings):
    model_config = _BASE_CONFIG

    opensearch_url: str = "http://localhost:9200"
    opensearch_index: str = "legal_documents"


class S3Settings(BaseSettings):
    model_config = _BASE_CONFIG

    s3_endpoint_url: str | None = None
    s3_region: str = "ap-south-1"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "legalos-documents"


class LLMSettings(BaseSettings):
    model_config = _BASE_CONFIG

    llm_provider: str = "openai_compatible"
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str = ""
    llm_model: str = "gemini-3.1-pro-preview"
    embedding_base_url: str = "https://api.openai.com/v1"
    embedding_api_key: str = ""
    embedding_model: str = "text-embedding-3-small"
    embedding_dim: int = 1536
    llm_use_stub: bool = True
    embedding_use_stub: bool = True
    tts_model: str = "gemini-2.5-flash-preview-tts"
    tts_voice: str = "Kore"


class CommonSettings(BaseSettings):
    """Cross-cutting runtime settings shared by every service."""

    model_config = _BASE_CONFIG

    environment: str = "development"
    log_level: str = "INFO"
    service_name: str = "legalos-service"
    redis_url: str = "redis://localhost:6379/0"
    kafka_bootstrap_servers: str = "localhost:9092"
    otel_exporter_otlp_endpoint: str = "http://localhost:4317"
    otel_sdk_disabled: bool = True

    auth_service_url: str = "http://localhost:8001"
    ingestion_service_url: str = "http://localhost:8002"
    search_service_url: str = "http://localhost:8003"
    research_service_url: str = "http://localhost:8004"
    document_service_url: str = "http://localhost:8005"
    reasoning_service_url: str = "http://localhost:8006"
    drafting_service_url: str = "http://localhost:8007"
    contract_review_service_url: str = "http://localhost:8008"
    litigation_service_url: str = "http://localhost:8009"
    corpus_registry_path: str = "data/corpus_registry.yaml"

    security: SecuritySettings = Field(default_factory=SecuritySettings)
    postgres: PostgresSettings = Field(default_factory=PostgresSettings)
    qdrant: QdrantSettings = Field(default_factory=QdrantSettings)
    neo4j: Neo4jSettings = Field(default_factory=Neo4jSettings)
    opensearch: OpenSearchSettings = Field(default_factory=OpenSearchSettings)
    s3: S3Settings = Field(default_factory=S3Settings)
    llm: LLMSettings = Field(default_factory=LLMSettings)


@lru_cache
def get_common_settings() -> CommonSettings:
    return CommonSettings()
