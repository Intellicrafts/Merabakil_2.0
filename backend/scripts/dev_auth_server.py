#!/usr/bin/env python3
"""Auth service — dev mode (in-memory users, no Postgres)."""
from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "backend" / "scripts"))
from dev_bootstrap import bootstrap_dev_env  # noqa: E402

bootstrap_dev_env(_ROOT)

sys.path[:0] = [
    str(_ROOT / "backend" / "libs" / "legalos_common"),
    str(_ROOT / "backend" / "services" / "auth"),
]

from app.api.deps import enforce_rate_limit, get_auth_service  # noqa: E402
from app.application.use_cases import AuthService  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from legalos_common.security.passwords import hash_password  # noqa: E402
from legalos_common.security.rbac import Permission, Role  # noqa: E402
from tests.fakes import (  # noqa: E402
    FakeOAuthIdentityRepository,
    FakePasswordResetRepository,
    FakeRefreshTokenRepository,
    FakeRole,
    FakeUser,
    FakeUserRepository,
)

ADMIN_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
ADVOCATE_ID = uuid.UUID("00000000-0000-4000-8000-000000000010")
CITIZEN_ID = uuid.UUID("00000000-0000-4000-8000-000000000011")
STATE_FILE = _ROOT / "data" / ".dev-auth-state.json"

_users = FakeUserRepository()
_oauth = FakeOAuthIdentityRepository()
_refresh = FakeRefreshTokenRepository()
_resets = FakePasswordResetRepository()


def _admin_user() -> FakeUser:
    return FakeUser(
        id=ADMIN_ID,
        email="admin@legalos.in",
        full_name="Platform Administrator",
        hashed_password=hash_password("ChangeMe!2026"),
        is_active=True,
        is_verified=True,
        roles_data=[FakeRole(name=Role.ADMIN.value, permissions=[p.value for p in Permission])],
    )


def _citizen_user() -> FakeUser:
    return FakeUser(
        id=CITIZEN_ID,
        email="citizen@legalos.in",
        full_name="Aarav Mehta",
        hashed_password=hash_password("ChangeMe!2026"),
        is_active=True,
        is_verified=True,
        roles_data=[
            FakeRole(
                name=Role.CITIZEN.value,
                permissions=[
                    Permission.RESEARCH_READ.value,
                    Permission.SEARCH_READ.value,
                    Permission.CASE_READ.value,
                ],
            )
        ],
    )


def _advocate_user() -> FakeUser:
    return FakeUser(
        id=ADVOCATE_ID,
        email="advocate@legalos.in",
        full_name="Adv. Priya Sharma",
        hashed_password=hash_password("ChangeMe!2026"),
        is_active=True,
        is_verified=True,
        roles_data=[
            FakeRole(
                name=Role.ADVOCATE.value,
                permissions=[
                    Permission.RESEARCH_READ.value,
                    Permission.SEARCH_READ.value,
                    Permission.KNOWLEDGE_INGEST.value,
                    Permission.CASE_READ.value,
                    Permission.CASE_WRITE.value,
                    Permission.COURTROOM_SIMULATE.value,
                    Permission.DOCUMENT_READ.value,
                    Permission.DOCUMENT_WRITE.value,
                ],
            )
        ],
    )


def _ensure_demo_users() -> None:
    by_email = {u.email: u for u in _users.store.values()}
    if "citizen@legalos.in" not in by_email and CITIZEN_ID not in _users.store:
        _users.store[CITIZEN_ID] = _citizen_user()
    if "advocate@legalos.in" not in by_email and ADVOCATE_ID not in _users.store:
        _users.store[ADVOCATE_ID] = _advocate_user()


def _save_state() -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    users_payload = []
    for user in _users.store.values():
        users_payload.append(
            {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "hashed_password": user.hashed_password,
                "is_active": user.is_active,
                "is_verified": user.is_verified,
                "roles_data": [
                    {"name": r.name, "permissions": r.permissions} for r in user.roles_data
                ],
            }
        )
    refresh_payload = {
        jti: {
            "user_id": str(tok["user_id"]),
            "expires_at": tok["expires_at"].isoformat(),
            "revoked": tok["revoked"],
        }
        for jti, tok in _refresh.tokens.items()
    }
    STATE_FILE.write_text(
        json.dumps({"users": users_payload, "refresh_tokens": refresh_payload}, indent=2),
        encoding="utf-8",
    )


def _load_state() -> None:
    if not STATE_FILE.is_file():
        _users.store[ADMIN_ID] = _admin_user()
        _ensure_demo_users()
        _save_state()
        return
    try:
        raw = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        _users.store[ADMIN_ID] = _admin_user()
        return

    for entry in raw.get("users", []):
        user = FakeUser(
            id=uuid.UUID(entry["id"]),
            email=entry["email"],
            full_name=entry["full_name"],
            hashed_password=entry["hashed_password"],
            is_active=entry.get("is_active", True),
            is_verified=entry.get("is_verified", False),
            roles_data=[
                FakeRole(name=r["name"], permissions=r.get("permissions", []))
                for r in entry.get("roles_data", [])
            ],
        )
        _users.store[user.id] = user

    if ADMIN_ID not in _users.store:
        _users.store[ADMIN_ID] = _admin_user()
    _ensure_demo_users()
    _save_state()

    for jti, tok in raw.get("refresh_tokens", {}).items():
        _refresh.tokens[jti] = {
            "user_id": uuid.UUID(tok["user_id"]),
            "expires_at": datetime.fromisoformat(tok["expires_at"]),
            "revoked": tok.get("revoked", False),
        }


class PersistingAuthService(AuthService):
    async def register(
        self,
        *,
        email: str,
        full_name: str,
        password: str,
        role: str,
    ):
        result = await super().register(
            email=email, full_name=full_name, password=password, role=role
        )
        _save_state()
        return result

    async def authenticate(self, *, email: str, password: str):
        result = await super().authenticate(email=email, password=password)
        _save_state()
        return result

    async def refresh(self, *, refresh_token: str):
        result = await super().refresh(refresh_token=refresh_token)
        _save_state()
        return result

    async def authenticate_with_google(self, *, id_token: str):
        result = await super().authenticate_with_google(id_token=id_token)
        _save_state()
        return result

    async def complete_google_registration(self, *, onboarding_token: str, role: str):
        result = await super().complete_google_registration(
            onboarding_token=onboarding_token, role=role
        )
        _save_state()
        return result


_load_state()


def _svc() -> AuthService:
    return PersistingAuthService(
        users=_users,
        oauth_identities=_oauth,
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
