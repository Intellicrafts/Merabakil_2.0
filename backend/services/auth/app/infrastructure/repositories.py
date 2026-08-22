"""SQLAlchemy repository implementations."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models import (
    AdvocateProfile,
    CitizenProfile,
    EnterpriseProfile,
    LawFirmProfile,
    PasswordResetToken,
    RefreshToken,
    Role,
    User,
)


class SqlAlchemyUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(User).where(func.lower(User.email) == email.lower())
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return await self._session.get(User, user_id)

    async def create(self, *, email: str, full_name: str, hashed_password: str) -> User:
        user = User(email=email, full_name=full_name, hashed_password=hashed_password)
        self._session.add(user)
        await self._session.flush()
        return user

    async def assign_roles(self, user: User, role_names: list[str]) -> None:
        result = await self._session.execute(select(Role).where(Role.name.in_(role_names)))
        roles = list(result.scalars().all())
        user.roles = roles
        await self._session.flush()

    async def create_role_profile(self, user: User, role_name: str) -> None:
        """Create the mandatory one-to-one profile for a self-service role."""
        profiles = {
            "citizen": CitizenProfile(user_id=user.id),
            "advocate": AdvocateProfile(user_id=user.id, full_name=user.full_name),
            "law_firm": LawFirmProfile(user_id=user.id, firm_name=user.full_name),
            "enterprise": EnterpriseProfile(user_id=user.id, organization_name=user.full_name),
        }
        profile = profiles.get(role_name)
        if profile is not None:
            self._session.add(profile)
            await self._session.flush()

    async def update_password(self, user: User, hashed_password: str) -> None:
        user.hashed_password = hashed_password
        await self._session.flush()

    async def list_users(self, *, offset: int, limit: int) -> tuple[list[User], int]:
        total = await self._session.scalar(select(func.count()).select_from(User)) or 0
        result = await self._session.execute(
            select(User).order_by(User.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total


class SqlAlchemyRefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def store(self, *, user_id: uuid.UUID, jti: str, expires_at: datetime) -> RefreshToken:
        token = RefreshToken(user_id=user_id, jti=jti, expires_at=expires_at)
        self._session.add(token)
        await self._session.flush()
        return token

    async def get_active(self, jti: str) -> RefreshToken | None:
        result = await self._session.execute(
            select(RefreshToken).where(
                RefreshToken.jti == jti,
                RefreshToken.revoked.is_(False),
                RefreshToken.expires_at > datetime.now(UTC),
            )
        )
        return result.scalar_one_or_none()

    async def revoke(self, jti: str) -> None:
        token = (
            await self._session.execute(select(RefreshToken).where(RefreshToken.jti == jti))
        ).scalar_one_or_none()
        if token is not None:
            token.revoked = True
            await self._session.flush()


class SqlAlchemyPasswordResetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, *, user_id: uuid.UUID, token_hash: str, expires_at: datetime) -> None:
        self._session.add(
            PasswordResetToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
        )
        await self._session.flush()

    async def consume(self, token_hash: str) -> uuid.UUID | None:
        result = await self._session.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash,
                PasswordResetToken.used.is_(False),
                PasswordResetToken.expires_at > datetime.now(UTC),
            )
        )
        token = result.scalar_one_or_none()
        if token is None:
            return None
        token.used = True
        await self._session.flush()
        return token.user_id
