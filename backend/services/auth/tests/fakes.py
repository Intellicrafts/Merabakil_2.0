"""In-memory repository fakes for fast, DB-free testing."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime


@dataclass
class FakeRole:
    name: str
    permissions: list[str]


@dataclass
class FakeUser:
    id: uuid.UUID
    email: str
    full_name: str
    hashed_password: str
    is_active: bool = True
    is_verified: bool = False
    roles_data: list[FakeRole] = field(default_factory=list)

    @property
    def role_names(self) -> list[str]:
        return [r.name for r in self.roles_data]

    @property
    def permission_codes(self) -> list[str]:
        codes: set[str] = set()
        for r in self.roles_data:
            codes.update(r.permissions)
        return sorted(codes)


_ROLE_CATALOG = {
    "citizen": ["research:read", "search:read"],
    "advocate": ["research:read", "search:read", "knowledge:ingest", "case:read", "case:write"],
    "admin": ["user:manage", "role:manage", "research:read", "search:read"],
}


class FakeUserRepository:
    def __init__(self) -> None:
        self.store: dict[uuid.UUID, FakeUser] = {}

    async def get_by_email(self, email: str) -> FakeUser | None:
        return next((u for u in self.store.values() if u.email.lower() == email.lower()), None)

    async def get_by_id(self, user_id: uuid.UUID) -> FakeUser | None:
        return self.store.get(user_id)

    async def create(self, *, email: str, full_name: str, hashed_password: str) -> FakeUser:
        user = FakeUser(
            id=uuid.uuid4(), email=email, full_name=full_name, hashed_password=hashed_password
        )
        self.store[user.id] = user
        return user

    async def assign_roles(self, user: FakeUser, role_names: list[str]) -> None:
        user.roles_data = [
            FakeRole(name=n, permissions=_ROLE_CATALOG.get(n, [])) for n in role_names
        ]

    async def update_password(self, user: FakeUser, hashed_password: str) -> None:
        user.hashed_password = hashed_password

    async def list_users(self, *, offset: int, limit: int) -> tuple[list[FakeUser], int]:
        users = list(self.store.values())
        return users[offset : offset + limit], len(users)


class FakeRefreshTokenRepository:
    def __init__(self) -> None:
        self.tokens: dict[str, dict] = {}

    async def store(self, *, user_id: uuid.UUID, jti: str, expires_at: datetime):
        self.tokens[jti] = {"user_id": user_id, "expires_at": expires_at, "revoked": False}
        return self.tokens[jti]

    async def get_active(self, jti: str):
        tok = self.tokens.get(jti)
        if tok and not tok["revoked"] and tok["expires_at"] > datetime.now(UTC):
            return tok
        return None

    async def revoke(self, jti: str) -> None:
        if jti in self.tokens:
            self.tokens[jti]["revoked"] = True


class FakePasswordResetRepository:
    def __init__(self) -> None:
        self.tokens: dict[str, dict] = {}

    async def create(self, *, user_id: uuid.UUID, token_hash: str, expires_at: datetime) -> None:
        self.tokens[token_hash] = {"user_id": user_id, "expires_at": expires_at, "used": False}

    async def consume(self, token_hash: str) -> uuid.UUID | None:
        tok = self.tokens.get(token_hash)
        if tok and not tok["used"] and tok["expires_at"] > datetime.now(UTC):
            tok["used"] = True
            return tok["user_id"]
        return None
