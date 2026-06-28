"""AES-256-GCM authenticated field encryption for data at rest.

Use for sensitive PII columns (e.g. case notes, contact details). The key is a
32-byte value provided as 64 hex characters via ``FIELD_ENCRYPTION_KEY``.
"""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from legalos_common.config import get_common_settings

_NONCE_BYTES = 12


class AESCipher:
    """AES-256-GCM cipher. Ciphertext is base64(nonce || ciphertext || tag)."""

    def __init__(self, key: bytes | None = None) -> None:
        if key is None:
            key = bytes.fromhex(get_common_settings().security.field_encryption_key)
        if len(key) != 32:
            raise ValueError("AES-256 requires a 32-byte key (64 hex characters).")
        self._aesgcm = AESGCM(key)

    def encrypt(self, plaintext: str, *, associated_data: bytes | None = None) -> str:
        nonce = os.urandom(_NONCE_BYTES)
        ct = self._aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data)
        return base64.b64encode(nonce + ct).decode("ascii")

    def decrypt(self, token: str, *, associated_data: bytes | None = None) -> str:
        raw = base64.b64decode(token)
        nonce, ct = raw[:_NONCE_BYTES], raw[_NONCE_BYTES:]
        return self._aesgcm.decrypt(nonce, ct, associated_data).decode("utf-8")
