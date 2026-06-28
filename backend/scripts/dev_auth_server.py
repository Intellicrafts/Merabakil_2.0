#!/usr/bin/env python3
"""Auth service — dev mode (in-memory users, no Postgres)."""
from __future__ import annotations

import os
import sys
import uuid

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path[:0] = [
    os.path.join(_ROOT, "backend", "libs", "legalos_common"),
    os.path.join(_ROOT, "backend", "services", "auth"),
]

os.environ.setdefault("LLM_USE_STUB", "true")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")
os.environ.setdefault("JWT_SECRET_KEY", "dev-local-secret")
os.environ.setdefault(
    "FIELD_ENCRYPTION_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
)

from app.api.deps import enforce_rate_limit, get_auth_service  # noqa: E402
from app.application.use_cases import AuthService  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from legalos_common.security.passwords import hash_password  # noqa: E402
from legalos_common.security.rbac import Permission, Role  # noqa: E402
from tests.fakes import (  # noqa: E402
    FakePasswordResetRepository,
    FakeRefreshTokenRepository,
    FakeRole,
    FakeUser,
    FakeUserRepository,
)

_users = FakeUserRepository()
_refresh = FakeRefreshTokenRepository()
_resets = FakePasswordResetRepository()

admin = FakeUser(
    id=uuid.uuid4(),
    email="admin@legalos.in",
    full_name="Platform Administrator",
    hashed_password=hash_password("ChangeMe!2026"),
    is_active=True,
    is_verified=True,
    roles_data=[FakeRole(name=Role.ADMIN.value, permissions=[p.value for p in Permission])],
)
_users.store[admin.id] = admin


def _svc() -> AuthService:
    return AuthService(
        users=_users,
        refresh_tokens=_refresh,
        password_resets=_resets,
        settings=get_settings(),
    )


app.dependency_overrides[get_auth_service] = _svc
app.dependency_overrides[enforce_rate_limit] = lambda: None

if __name__ == "__main__":
    import uvicorn

    print("Auth (dev) http://localhost:8001/docs — admin@legalos.in / ChangeMe!2026")
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
