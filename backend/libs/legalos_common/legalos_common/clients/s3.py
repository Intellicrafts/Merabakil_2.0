"""S3 / MinIO object storage wrapper (boto3 run in a thread pool)."""

from __future__ import annotations

import asyncio
from functools import partial

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
        existing = {b["Name"] for b in self._client.list_buckets().get("Buckets", [])}
        if self._bucket not in existing:
            self._client.create_bucket(Bucket=self._bucket)
            logger.info("s3_bucket_created", bucket=self._bucket)

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
