from __future__ import annotations

import os
from functools import lru_cache

from pydantic import model_validator

from legalos_common.config import CommonSettings


class AuthSettings(CommonSettings):
    service_name: str = "auth-service"
    # Rate limit: requests per window per client IP for auth-sensitive endpoints.
    rate_limit_max_requests: int = 10
    rate_limit_window_seconds: int = 60
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""

    @model_validator(mode="after")
    def _google_client_id_fallback(self) -> AuthSettings:
        if not self.google_oauth_client_id.strip():
            fallback = os.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID", "").strip()
            if fallback:
                self.google_oauth_client_id = fallback
        return self


@lru_cache
def get_settings() -> AuthSettings:
    return AuthSettings()
