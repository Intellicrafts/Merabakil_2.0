"""Local disk storage for appointment attachments."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

def _find_root() -> Path:
    p = Path(__file__).resolve()
    for _ in range(7):
        if (p / "data").exists():
            return p
        if p.parent == p:
            break
        p = p.parent
    return Path("/app")  # Docker fallback

_ROOT = _find_root()

ALLOWED_EXT = {".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".webm", ".ogg", ".mp3", ".m4a", ".mp4", ".wav"}
ALLOWED_MIME = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "image/png",
    "image/jpeg",
    "image/webp",
    "audio/webm",
    "audio/ogg",
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/x-wav",
    "audio/x-m4a",
}
MAX_BYTES = 15 * 1024 * 1024
IMAGE_KINDS = frozenset({"image", "screenshot"})
AUDIO_KINDS = frozenset({"voice"})
AUDIO_EXT = {".webm", ".ogg", ".mp3", ".m4a", ".mp4", ".wav"}


def files_root() -> Path:
    override = os.getenv("APPOINTMENT_FILES_DIR")
    path = Path(override) if override else _ROOT / "data" / "appointment-files"
    path.mkdir(parents=True, exist_ok=True)
    return path


def ext_of(filename: str) -> str:
    return Path(filename or "").suffix.lower()


def validate_upload(*, filename: str, content_type: str, size: int) -> str | None:
    if size <= 0:
        return "File is empty"
    if size > MAX_BYTES:
        return "File must be 15 MB or smaller"
    if ext_of(filename) not in ALLOWED_EXT:
        return "That file type is not allowed"
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime and mime not in ALLOWED_MIME:
        return "That file type is not allowed"
    return None


def infer_kind(filename: str, requested: str | None) -> str:
    asked = (requested or "").strip().lower()
    if asked in {"document", "image", "screenshot", "voice"}:
        return asked
    if ext_of(filename) in AUDIO_EXT:
        return "voice"
    return "image" if ext_of(filename) in {".png", ".jpg", ".jpeg", ".webp"} else "document"


def write_bytes(appointment_id: uuid.UUID, attachment_id: uuid.UUID, data: bytes) -> str:
    folder = files_root() / str(appointment_id)
    folder.mkdir(parents=True, exist_ok=True)
    dest = folder / str(attachment_id)
    dest.write_bytes(data)
    return str(dest)


def resolve_path(storage_path: str) -> Path:
    return Path(storage_path)
