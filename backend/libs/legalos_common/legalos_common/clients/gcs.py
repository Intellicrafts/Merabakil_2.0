"""Google Cloud Storage object store (native SDK, run in a thread pool).

Auth is via Application Default Credentials — on the GCE VM this is the attached
``merabakil-storage`` service account, so no key files are needed. Objects are
private; browser-facing images are handed out as short-lived V4 signed URLs.

Use ``build_storage(settings)`` / ``build_avatar_storage(settings)`` — they fall
back to ``LocalFileStorage`` when ``GCS_PROJECT`` is unset (native dev).
"""

from __future__ import annotations

import asyncio
from datetime import timedelta
from functools import partial

from legalos_common.clients.storage import LocalFileStorage
from legalos_common.config import StorageSettings
from legalos_common.logging import get_logger

logger = get_logger(__name__)


class GCSStorage:
    def __init__(
        self,
        bucket: str,
        *,
        project: str | None = None,
        signed_url_ttl: int = 604_800,
    ) -> None:
        from google.cloud import storage  # imported lazily so dev/local needs no GCP deps

        self._bucket_name = bucket
        self._signed_url_ttl = signed_url_ttl
        self._client = storage.Client(project=project)
        self._bucket = self._client.bucket(bucket)

    @property
    def bucket(self) -> str:
        return self._bucket_name

    async def ensure_bucket(self) -> None:
        # Buckets are created out-of-band (Terraform / provision-gcs.sh) and the
        # runtime SA only holds object-level permissions, so this is a no-op.
        logger.info("gcs_storage_ready", bucket=self._bucket_name)

    async def put_object(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        def _upload() -> str:
            blob = self._bucket.blob(key)
            blob.upload_from_string(data, content_type=content_type)
            return f"gs://{self._bucket_name}/{key}"

        return await asyncio.to_thread(_upload)

    async def get_object(self, key: str) -> bytes:
        return await asyncio.to_thread(
            partial(self._bucket.blob(key).download_as_bytes)
        )

    async def delete_object(self, key: str) -> None:
        def _delete() -> None:
            from google.cloud.exceptions import NotFound

            try:
                self._bucket.blob(key).delete()
            except NotFound:
                pass

        await asyncio.to_thread(_delete)

    async def signed_url(self, key: str, *, expires_in: int | None = None) -> str:
        ttl = expires_in or self._signed_url_ttl
        return await asyncio.to_thread(self._signed_url_sync, key, ttl)

    def _signed_url_sync(self, key: str, ttl: int) -> str:
        blob = self._bucket.blob(key)
        creds = self._client._credentials
        kwargs: dict = {
            "version": "v4",
            "expiration": timedelta(seconds=ttl),
            "method": "GET",
        }
        # Keyless signing: compute/ADC credentials have no private key, so sign via
        # IAM SignBlob using the SA email + a fresh access token. Requires the SA to
        # hold roles/iam.serviceAccountTokenCreator on itself (granted in provisioning).
        email = getattr(creds, "service_account_email", None)
        if email and email != "default":
            token = getattr(creds, "token", None)
            if not token:
                from google.auth.transport.requests import Request

                creds.refresh(Request())
                token = creds.token
            kwargs["service_account_email"] = email
            kwargs["access_token"] = token
        return blob.generate_signed_url(**kwargs)


def build_storage(settings: StorageSettings):
    """Private object store (documents/ingested files). Local FS in native dev."""
    if not settings.use_gcs:
        logger.info("storage_backend=local base=%s", settings.local_root)
        return LocalFileStorage(settings.local_root)
    return GCSStorage(
        settings.gcs_bucket,
        project=settings.gcs_project,
        signed_url_ttl=settings.signed_url_ttl,
    )


def build_avatar_storage(settings: StorageSettings):
    """Avatar/profile-photo object store (served via signed URLs). Local FS in dev."""
    if not settings.use_gcs:
        logger.info("avatar_storage_backend=local base=%s/avatars", settings.local_root)
        return LocalFileStorage(f"{settings.local_root}/avatars")
    return GCSStorage(
        settings.gcs_public_bucket,
        project=settings.gcs_project,
        signed_url_ttl=settings.signed_url_ttl,
    )
