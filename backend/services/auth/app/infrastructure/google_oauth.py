"""Google ID token verification and onboarding token helpers."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from jose import JWTError, jwt
from pydantic import BaseModel, ValidationError

from legalos_common.config import get_common_settings

GOOGLE_PROVIDER = "google"
ONBOARDING_TOKEN_TYPE = "onboarding"
ONBOARDING_TOKEN_MINUTES = 10


@dataclass(slots=True)
class GoogleProfile:
    sub: str
    email: str
    full_name: str
    picture: str | None
    email_verified: bool


class OnboardingTokenPayload(BaseModel):
    type: str
    google_sub: str
    email: str
    full_name: str
    picture: str | None = None
    jti: str
    exp: int
    iat: int


def verify_google_id_token(id_token_str: str, *, client_id: str) -> GoogleProfile:
    """Verify a Google Identity Services credential and return profile claims."""
    if not client_id:
        raise ValueError("Google OAuth client ID is not configured")

    request = google_requests.Request()
    claims = id_token.verify_oauth2_token(id_token_str, request, client_id)

    email = claims.get("email")
    if not email:
        raise ValueError("Google token missing email claim")
    if not claims.get("email_verified", False):
        raise ValueError("Google email is not verified")

    sub = claims.get("sub")
    if not sub:
        raise ValueError("Google token missing sub claim")

    return GoogleProfile(
        sub=str(sub),
        email=str(email).lower(),
        full_name=str(claims.get("name") or email.split("@")[0]),
        picture=claims.get("picture"),
        email_verified=True,
    )


def create_onboarding_token(profile: GoogleProfile) -> str:
    settings = get_common_settings().security
    now = datetime.now(UTC)
    payload = {
        "type": ONBOARDING_TOKEN_TYPE,
        "google_sub": profile.sub,
        "email": profile.email,
        "full_name": profile.full_name,
        "picture": profile.picture,
        "jti": str(uuid.uuid4()),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ONBOARDING_TOKEN_MINUTES)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_onboarding_token(token: str) -> OnboardingTokenPayload:
    settings = get_common_settings().security
    try:
        raw = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        payload = OnboardingTokenPayload.model_validate(raw)
    except (JWTError, ValidationError) as exc:
        raise JWTError(str(exc)) from exc
    if payload.type != ONBOARDING_TOKEN_TYPE:
        raise JWTError("Expected onboarding token")
    return payload
