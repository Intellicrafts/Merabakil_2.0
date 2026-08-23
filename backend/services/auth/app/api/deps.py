"""FastAPI dependency wiring for the auth API."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases import AuthService
from app.config import AuthSettings, get_settings
from app.infrastructure.db import get_session
from app.infrastructure.rate_limit import RateLimiter
from app.infrastructure.repositories import (
    SqlAlchemyOAuthIdentityRepository,
    SqlAlchemyPasswordResetRepository,
    SqlAlchemyRefreshTokenRepository,
    SqlAlchemyUserRepository,
)

_settings = get_settings()
_rate_limiter = RateLimiter(
    _settings.redis_url,
    max_requests=_settings.rate_limit_max_requests,
    window_seconds=_settings.rate_limit_window_seconds,
)


def get_auth_settings() -> AuthSettings:
    return _settings


def get_auth_service(session: AsyncSession = Depends(get_session)) -> AuthService:
    return AuthService(
        users=SqlAlchemyUserRepository(session),
        oauth_identities=SqlAlchemyOAuthIdentityRepository(session),
        refresh_tokens=SqlAlchemyRefreshTokenRepository(session),
        password_resets=SqlAlchemyPasswordResetRepository(session),
        settings=_settings,
    )


async def enforce_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client else "unknown"
    key = f"{request.url.path}:{client_ip}"
    if not await _rate_limiter.allow(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please retry later.",
        )
