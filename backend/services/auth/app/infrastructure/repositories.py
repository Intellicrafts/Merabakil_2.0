"""SQLAlchemy repository implementations."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models import (
    AdvocateProfile,
    CitizenProfile,
    EnterpriseProfile,
    LawFirmProfile,
    OAuthIdentity,
    PasswordResetToken,
    RefreshToken,
    Role,
    User,
    UserConsent,
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

    async def create(
        self,
        *,
        email: str,
        full_name: str,
        hashed_password: str | None = None,
        is_verified: bool = False,
    ) -> User:
        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hashed_password,
            is_verified=is_verified,
        )
        self._session.add(user)
        await self._session.flush()
        return user

    async def assign_roles(self, user: User, role_names: list[str]) -> None:
        result = await self._session.execute(select(Role).where(Role.name.in_(role_names)))
        roles = list(result.scalars().all())
        # Refresh the roles attribute asynchronously before assigning to avoid
        # SQLAlchemy triggering a synchronous lazy load in an async context.
        await self._session.refresh(user, attribute_names=["roles"])
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

    async def list_users(
        self,
        *,
        offset: int,
        limit: int,
        search: str | None = None,
        is_active: bool | None = None,
        role: str | None = None,
    ) -> tuple[list[User], int]:
        base = select(User)
        if search:
            term = f"%{search.lower()}%"
            base = base.where(
                or_(func.lower(User.full_name).like(term), func.lower(User.email).like(term))
            )
        if is_active is not None:
            base = base.where(User.is_active == is_active)
        if role:
            base = base.join(User.roles).where(Role.name == role)
        count_q = select(func.count()).select_from(base.subquery())
        total = await self._session.scalar(count_q) or 0
        result = await self._session.execute(
            base.order_by(User.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all()), total

    async def update_user(
        self,
        user: User,
        *,
        full_name: str | None,
        is_active: bool | None,
    ) -> User:
        if full_name is not None:
            user.full_name = full_name
        if is_active is not None:
            user.is_active = is_active
        await self._session.flush()
        return user


class SqlAlchemyOAuthIdentityRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_provider_user(
        self, *, provider: str, provider_user_id: str
    ) -> OAuthIdentity | None:
        result = await self._session.execute(
            select(OAuthIdentity).where(
                OAuthIdentity.provider == provider,
                OAuthIdentity.provider_user_id == provider_user_id,
            )
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        provider: str,
        provider_user_id: str,
        email: str | None,
    ) -> OAuthIdentity:
        identity = OAuthIdentity(
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
        )
        self._session.add(identity)
        await self._session.flush()
        return identity


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


class SqlAlchemyUserConsentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(
        self,
        *,
        user_id: uuid.UUID,
        consent_type: str,
        version: str,
        ip_hash: str | None = None,
    ) -> UserConsent:
        now = datetime.now(UTC)
        consent = UserConsent(
            user_id=user_id,
            consent_type=consent_type,
            version=version,
            accepted_at=now,
            ip_hash=ip_hash,
            created_at=now,
        )
        self._session.add(consent)
        await self._session.flush()
        return consent

    async def list_for_user(self, user_id: uuid.UUID) -> list[UserConsent]:
        result = await self._session.execute(
            select(UserConsent)
            .where(UserConsent.user_id == user_id)
            .order_by(UserConsent.accepted_at.desc())
        )
        return list(result.scalars().all())
