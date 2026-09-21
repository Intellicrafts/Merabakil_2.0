"""Avatar object storage for user profile photos."""

from __future__ import annotations

import io
import uuid
from functools import lru_cache

from PIL import Image, UnidentifiedImageError

from app.config import AuthSettings, get_settings
from legalos_common.api.errors import ValidationFailedError
from legalos_common.clients import build_avatar_storage

AVATAR_PREFIX = "avatars/"
MAX_AVATAR_BYTES = 2 * 1024 * 1024
MAX_DIMENSION = 512
ALLOWED_CONTENT_TYPES = frozenset({"image/jpeg", "image/png", "image/webp"})
STORAGE_SCHEME = "storage://"


def avatar_storage_key(user_id: uuid.UUID) -> str:
    return f"{AVATAR_PREFIX}{user_id}.webp"


def is_external_avatar_url(url: str | None) -> bool:
    return bool(url and url.startswith(("http://", "https://")))


def is_stored_avatar_url(url: str | None) -> bool:
    return bool(url and url.startswith(STORAGE_SCHEME))


def stored_key_from_url(url: str) -> str:
    return url.removeprefix(STORAGE_SCHEME)


class AvatarStore:
    def __init__(self, settings: AuthSettings) -> None:
        self._settings = settings
        self._storage = build_avatar_storage(settings.storage)

    async def ensure_ready(self) -> None:
        await self._storage.ensure_bucket()

    def _normalize_image(self, raw: bytes, content_type: str) -> tuple[bytes, str]:
        if len(raw) > MAX_AVATAR_BYTES:
            raise ValidationFailedError("Image exceeds the 2 MB limit")
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValidationFailedError("Unsupported image type. Upload JPEG, PNG, or WebP.")

        try:
            with Image.open(io.BytesIO(raw)) as img:
                img = img.convert("RGBA")
                width, height = img.size
                side = min(width, height)
                left = (width - side) // 2
                top = (height - side) // 2
                img = img.crop((left, top, left + side, top + side))
                if side > MAX_DIMENSION:
                    img = img.resize((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3])
                out = io.BytesIO()
                background.save(out, format="WEBP", quality=85, method=6)
                data = out.getvalue()
        except UnidentifiedImageError as exc:
            raise ValidationFailedError("Invalid image file") from exc

        if len(data) > MAX_AVATAR_BYTES:
            raise ValidationFailedError("Processed image exceeds the 2 MB limit")
        return data, "image/webp"

    async def save(self, user_id: uuid.UUID, raw: bytes, content_type: str) -> str:
        data, normalized_type = self._normalize_image(raw, content_type)
        key = avatar_storage_key(user_id)
        await self._storage.put_object(key, data, content_type=normalized_type)
        return f"{STORAGE_SCHEME}{key}"

    async def load(self, storage_ref: str) -> tuple[bytes, str]:
        key = stored_key_from_url(storage_ref) if storage_ref.startswith(STORAGE_SCHEME) else storage_ref
        data = await self._storage.get_object(key)
        return data, "image/webp"

    async def delete(self, storage_ref: str) -> None:
        if not storage_ref.startswith(STORAGE_SCHEME):
            return
        key = stored_key_from_url(storage_ref)
        await self._storage.delete_object(key)


@lru_cache
def get_avatar_store() -> AvatarStore:
    return AvatarStore(get_settings())
