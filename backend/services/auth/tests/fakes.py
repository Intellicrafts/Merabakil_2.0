"""In-memory repository fakes for fast, DB-free testing."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime


@dataclass
class FakeRole:
    name: str
    permissions: list[str]


@dataclass
class FakeCitizenProfile:
    user_id: uuid.UUID
    phone: str | None = None
    date_of_birth: date | None = None
    address: str | None = None


@dataclass
class FakeUser:
    id: uuid.UUID
    email: str
    full_name: str
    hashed_password: str | None
    is_active: bool = True
    is_verified: bool = False
    avatar_url: str | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))
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


@dataclass
class FakeOAuthIdentity:
    id: uuid.UUID
    user_id: uuid.UUID
    provider: str
    provider_user_id: str
    email: str | None


from legalos_common.security.rbac import Permission


_ROLE_CATALOG = {
    "citizen": ["research:read", "search:read", "case:read"],
    "advocate": [
        "research:read",
        "search:read",
        "knowledge:ingest",
        "case:read",
        "case:write",
        "document:read",
        "document:write",
    ],
    "law_firm": [
        "research:read",
        "search:read",
        "knowledge:ingest",
        "case:read",
        "case:write",
        "document:read",
        "document:write",
    ],
    "enterprise": [
        "research:read",
        "search:read",
        "document:read",
        "document:write",
        "audit:read",
    ],
    "admin": [p.value for p in Permission],
}


class FakeUserRepository:
    def __init__(self) -> None:
        self.store: dict[uuid.UUID, FakeUser] = {}
        self.profile_roles: dict[uuid.UUID, str] = {}
        self.citizen_profiles: dict[uuid.UUID, FakeCitizenProfile] = {}

    async def get_by_email(self, email: str) -> FakeUser | None:
        return next((u for u in self.store.values() if u.email.lower() == email.lower()), None)

    async def get_by_id(self, user_id: uuid.UUID) -> FakeUser | None:
        return self.store.get(user_id)

    async def create(
        self,
        *,
        email: str,
        full_name: str,
        hashed_password: str | None = None,
        is_verified: bool = False,
    ) -> FakeUser:
        user = FakeUser(
            id=uuid.uuid4(),
            email=email,
            full_name=full_name,
            hashed_password=hashed_password,
            is_verified=is_verified,
        )
        self.store[user.id] = user
        return user

    async def assign_roles(self, user: FakeUser, role_names: list[str]) -> None:
        user.roles_data = [
            FakeRole(name=n, permissions=_ROLE_CATALOG.get(n, [])) for n in role_names
        ]

    async def create_role_profile(self, user: FakeUser, role_name: str) -> None:
        if role_name != "admin":
            self.profile_roles[user.id] = role_name
        if role_name == "citizen" and user.id not in self.citizen_profiles:
            self.citizen_profiles[user.id] = FakeCitizenProfile(user_id=user.id)

    async def update_password(self, user: FakeUser, hashed_password: str) -> None:
        user.hashed_password = hashed_password

    async def get_citizen_profile(self, user_id: uuid.UUID):
        user = self.store.get(user_id)
        profile = self.citizen_profiles.get(user_id)
        if user is None or profile is None:
            return None
        return user, profile

    async def update_citizen_profile(
        self,
        user: FakeUser,
        profile: FakeCitizenProfile,
        *,
        full_name: str | None = None,
        phone: str | None = None,
        date_of_birth=None,
        address: str | None = None,
        clear_phone: bool = False,
        clear_date_of_birth: bool = False,
        clear_address: bool = False,
    ) -> None:
        if full_name is not None:
            user.full_name = full_name
        if clear_phone:
            profile.phone = None
        elif phone is not None:
            profile.phone = phone
        if clear_date_of_birth:
            profile.date_of_birth = None
        elif date_of_birth is not None:
            profile.date_of_birth = date_of_birth
        if clear_address:
            profile.address = None
        elif address is not None:
            profile.address = address
        user.updated_at = datetime.now(UTC)

    async def update_avatar_url(self, user: FakeUser, avatar_url: str | None) -> None:
        user.avatar_url = avatar_url
        user.updated_at = datetime.now(UTC)

    async def update_full_name(self, user: FakeUser, full_name: str) -> None:
        user.full_name = full_name

    async def list_users(self, *, offset: int, limit: int) -> tuple[list[FakeUser], int]:
        users = list(self.store.values())
        return users[offset : offset + limit], len(users)


class FakeOAuthIdentityRepository:
    def __init__(self) -> None:
        self.store: list[FakeOAuthIdentity] = []

    async def get_by_provider_user(
        self, *, provider: str, provider_user_id: str
    ) -> FakeOAuthIdentity | None:
        return next(
            (
                i
                for i in self.store
                if i.provider == provider and i.provider_user_id == provider_user_id
            ),
            None,
        )

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        provider: str,
        provider_user_id: str,
        email: str | None,
    ) -> FakeOAuthIdentity:
        identity = FakeOAuthIdentity(
            id=uuid.uuid4(),
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
        )
        self.store.append(identity)
        return identity


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


@dataclass
class FakeUserConsent:
    user_id: uuid.UUID
    consent_type: str
    version: str
    accepted_at: datetime
    ip_hash: str | None = None


class FakeUserConsentRepository:
    def __init__(self) -> None:
        self.store: list[FakeUserConsent] = []

    async def record(
        self,
        *,
        user_id: uuid.UUID,
        consent_type: str,
        version: str,
        ip_hash: str | None = None,
    ) -> FakeUserConsent:
        consent = FakeUserConsent(
            user_id=user_id,
            consent_type=consent_type,
            version=version,
            accepted_at=datetime.now(UTC),
            ip_hash=ip_hash,
        )
        self.store.append(consent)
        return consent

    async def list_for_user(self, user_id: uuid.UUID) -> list[FakeUserConsent]:
        return [c for c in self.store if c.user_id == user_id]


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
