"""Repository ports (interfaces) for the auth domain - Repository Pattern."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Protocol

from app.infrastructure.models import OAuthIdentity, RefreshToken, User, UserConsent


class UserRepository(Protocol):
    async def get_by_email(self, email: str) -> User | None: ...
    async def get_by_id(self, user_id: uuid.UUID) -> User | None: ...
    async def create(
        self,
        *,
        email: str,
        full_name: str,
        hashed_password: str | None = None,
        is_verified: bool = False,
    ) -> User: ...
    async def assign_roles(self, user: User, role_names: list[str]) -> None: ...
    async def create_role_profile(self, user: User, role_name: str) -> object: ...
    async def update_password(self, user: User, hashed_password: str) -> None: ...
    async def list_users(self, *, offset: int, limit: int) -> tuple[list[User], int]: ...
    async def get_citizen_profile(self, user_id: uuid.UUID): ...
    async def update_citizen_profile(
        self,
        user: User,
        profile: object,
        *,
        full_name: str | None = None,
        phone: str | None = None,
        date_of_birth=None,
        address: str | None = None,
        clear_phone: bool = False,
        clear_date_of_birth: bool = False,
        clear_address: bool = False,
    ) -> None: ...
    async def update_avatar_url(self, user: User, avatar_url: str | None) -> None: ...
    async def update_full_name(self, user: User, full_name: str) -> None: ...


class OAuthIdentityRepository(Protocol):
    async def get_by_provider_user(
        self, *, provider: str, provider_user_id: str
    ) -> OAuthIdentity | None: ...
    async def create(
        self,
        *,
        user_id: uuid.UUID,
        provider: str,
        provider_user_id: str,
        email: str | None,
    ) -> OAuthIdentity: ...


class RefreshTokenRepository(Protocol):
    async def store(
        self, *, user_id: uuid.UUID, jti: str, expires_at: datetime
    ) -> RefreshToken: ...
    async def get_active(self, jti: str) -> RefreshToken | None: ...
    async def revoke(self, jti: str) -> None: ...


class PasswordResetRepository(Protocol):
    async def create(
        self, *, user_id: uuid.UUID, token_hash: str, expires_at: datetime
    ) -> None: ...
    async def consume(self, token_hash: str) -> uuid.UUID | None: ...


class UserConsentRepository(Protocol):
    async def record(
        self,
        *,
        user_id: uuid.UUID,
        consent_type: str,
        version: str,
        ip_hash: str | None = None,
    ) -> UserConsent: ...
    async def list_for_user(self, user_id: uuid.UUID) -> list[UserConsent]: ...
