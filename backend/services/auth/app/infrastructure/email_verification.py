"""JWT helpers for post-OTP email verification during registration."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from pydantic import BaseModel, ValidationError

from legalos_common.config import get_common_settings

EMAIL_VERIFICATION_TOKEN_TYPE = "email_verification"
EMAIL_VERIFICATION_TOKEN_MINUTES = 15


class EmailVerificationTokenPayload(BaseModel):
    type: str
    email: str
    jti: str
    exp: int
    iat: int


def create_verification_token(email: str) -> str:
    settings = get_common_settings().security
    now = datetime.now(UTC)
    payload = {
        "type": EMAIL_VERIFICATION_TOKEN_TYPE,
        "email": email.lower(),
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=EMAIL_VERIFICATION_TOKEN_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_verification_token(token: str) -> EmailVerificationTokenPayload:
    settings = get_common_settings().security
    try:
        raw = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        payload = EmailVerificationTokenPayload.model_validate(raw)
    except (JWTError, ValidationError) as exc:
        raise JWTError(str(exc)) from exc
    if payload.type != EMAIL_VERIFICATION_TOKEN_TYPE:
        raise JWTError("Expected email verification token")
    return payload
