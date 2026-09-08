"""S3 / MinIO object storage wrapper (boto3 run in a thread pool).

Use ``build_storage(settings)`` instead of instantiating directly — it returns
``LocalFileStorage`` when ``S3_ENDPOINT_URL`` is empty (native dev, no cloud needed).
"""

from __future__ import annotations

import asyncio
import os
from functools import partial
from pathlib import Path

import boto3
from botocore.client import Config

from legalos_common.config import S3Settings
from legalos_common.logging import get_logger

logger = get_logger(__name__)


class S3Storage:
    def __init__(self, settings: S3Settings) -> None:
        self._bucket = settings.s3_bucket
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(signature_version="s3v4"),
        )

    @property
    def bucket(self) -> str:
        return self._bucket

    def _ensure_bucket_sync(self) -> None:
        from botocore.exceptions import ClientError

        try:
            self._client.head_bucket(Bucket=self._bucket)
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("404", "NoSuchBucket"):
                self._client.create_bucket(Bucket=self._bucket)
                logger.info("s3_bucket_created", bucket=self._bucket)
            # 403/AccessDenied means the bucket exists — proceed

    async def ensure_bucket(self) -> None:
        await asyncio.to_thread(self._ensure_bucket_sync)

    async def put_object(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        await asyncio.to_thread(
            partial(
                self._client.put_object,
                Bucket=self._bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
        )
        return f"s3://{self._bucket}/{key}"

    async def get_object(self, key: str) -> bytes:
        resp = await asyncio.to_thread(
            partial(self._client.get_object, Bucket=self._bucket, Key=key)
        )
        return resp["Body"].read()

    async def presigned_url(self, key: str, *, expires_in: int = 3600) -> str:
        return await asyncio.to_thread(
            partial(
                self._client.generate_presigned_url,
                "get_object",
                Params={"Bucket": self._bucket, "Key": key},
                ExpiresIn=expires_in,
            )
        )


class LocalFileStorage:
    """Filesystem-backed storage for native dev — no S3/MinIO required."""

    def __init__(self, base_dir: str = "data/uploads") -> None:
        self._base = Path(base_dir)

    @property
    def bucket(self) -> str:
        return str(self._base)

    def _ensure_bucket_sync(self) -> None:
        self._base.mkdir(parents=True, exist_ok=True)

    async def ensure_bucket(self) -> None:
        await asyncio.to_thread(self._ensure_bucket_sync)

    async def put_object(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        dest = self._base / key
        dest.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(dest.write_bytes, data)
        logger.info("local_storage_put key=%s bytes=%d", key, len(data))
        return f"file://{dest.resolve()}"

    async def get_object(self, key: str) -> bytes:
        dest = self._base / key
        return await asyncio.to_thread(dest.read_bytes)

    async def presigned_url(self, key: str, *, expires_in: int = 3600) -> str:
        return f"file://{(self._base / key).resolve()}"


def build_storage(settings: S3Settings) -> "S3Storage | LocalFileStorage":
    """Return LocalFileStorage when S3_ENDPOINT_URL is unset (native dev)."""
    if not settings.s3_endpoint_url:
        logger.info("storage_backend=local base=data/uploads")
        return LocalFileStorage()
    return S3Storage(settings)
