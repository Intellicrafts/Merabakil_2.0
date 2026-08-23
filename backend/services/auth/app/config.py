from __future__ import annotations

from functools import lru_cache

from legalos_common.config import CommonSettings


class AuthSettings(CommonSettings):
    service_name: str = "auth-service"
    # Rate limit: requests per window per client IP for auth-sensitive endpoints.
    rate_limit_max_requests: int = 10
    rate_limit_window_seconds: int = 60
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""


@lru_cache
def get_settings() -> AuthSettings:
    return AuthSettings()
