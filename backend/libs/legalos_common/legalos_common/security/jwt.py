"""JWT access/refresh token creation and verification."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from jose import JWTError, jwt
from pydantic import BaseModel, ValidationError

from legalos_common.config import SecuritySettings, get_common_settings


class TokenType(StrEnum):
    ACCESS = "access"
    REFRESH = "refresh"


class TokenPayload(BaseModel):
    sub: str
    type: TokenType
    roles: list[str] = []
    permissions: list[str] = []
    jti: str
    exp: int
    iat: int


def _settings() -> SecuritySettings:
    return get_common_settings().security


def _create_token(
    *,
    subject: str,
    token_type: TokenType,
    expires_delta: timedelta,
    roles: list[str] | None = None,
    permissions: list[str] | None = None,
) -> str:
    now = datetime.now(UTC)
    settings = _settings()
    payload = {
        "sub": subject,
        "type": token_type.value,
        "roles": roles or [],
        "permissions": permissions or [],
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(
    subject: str,
    *,
    roles: list[str] | None = None,
    permissions: list[str] | None = None,
) -> str:
    settings = _settings()
    return _create_token(
        subject=subject,
        token_type=TokenType.ACCESS,
        expires_delta=timedelta(minutes=settings.jwt_access_token_expire_minutes),
        roles=roles,
        permissions=permissions,
    )


def create_refresh_token(subject: str) -> str:
    settings = _settings()
    return _create_token(
        subject=subject,
        token_type=TokenType.REFRESH,
        expires_delta=timedelta(minutes=settings.jwt_refresh_token_expire_minutes),
    )


def decode_token(token: str, *, expected_type: TokenType | None = None) -> TokenPayload:
    """Decode and validate a JWT. Raises ``JWTError`` on any failure."""
    settings = _settings()
    try:
        raw = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        payload = TokenPayload.model_validate(raw)
    except (JWTError, ValidationError) as exc:
        raise JWTError(str(exc)) from exc

    if expected_type is not None and payload.type != expected_type:
        raise JWTError(f"Expected {expected_type} token, received {payload.type}")
    return payload
