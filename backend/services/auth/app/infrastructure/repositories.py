"""SQLAlchemy repository implementations."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models import (
    AdvocateProfile,
    CitizenProfile,
    EmailOtpCode,
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
        acquisition_gclid: str | None = None,
        acquisition_utm_source: str | None = None,
        acquisition_utm_campaign: str | None = None,
    ) -> User:
        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hashed_password,
            is_verified=is_verified,
            acquisition_gclid=acquisition_gclid,
            acquisition_utm_source=acquisition_utm_source,
            acquisition_utm_campaign=acquisition_utm_campaign,
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

    async def create_role_profile(self, user: User, role_name: str) -> CitizenProfile | None:
        """Create the mandatory one-to-one profile for a self-service role.

        Returns the CitizenProfile when role_name is 'citizen', None otherwise.
        """
        if role_name == "citizen":
            result = await self._session.execute(
                select(CitizenProfile).where(CitizenProfile.user_id == user.id)
            )
            existing = result.scalar_one_or_none()
            if existing is not None:
                return existing
            profile = CitizenProfile(user_id=user.id)
            self._session.add(profile)
            await self._session.flush()
            return profile
        profiles = {
            "advocate": AdvocateProfile(user_id=user.id, full_name=user.full_name),
            "law_firm": LawFirmProfile(user_id=user.id, firm_name=user.full_name),
            "enterprise": EnterpriseProfile(user_id=user.id, organization_name=user.full_name),
        }
        p = profiles.get(role_name)
        if p is not None:
            self._session.add(p)
            await self._session.flush()
        return None

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

    async def get_citizen_profile(self, user_id: uuid.UUID) -> tuple[User, CitizenProfile] | None:
        user = await self.get_by_id(user_id)
        if user is None:
            return None
        result = await self._session.execute(
            select(CitizenProfile).where(CitizenProfile.user_id == user_id)
        )
        profile = result.scalar_one_or_none()
        if profile is None:
            return None
        return user, profile

    async def update_citizen_profile(
        self,
        user: User,
        profile: CitizenProfile,
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
        await self._session.flush()

    async def update_avatar_url(self, user: User, avatar_url: str | None) -> None:
        user.avatar_url = avatar_url
        await self._session.flush()

    async def refresh(self, user: User) -> None:
        """Reload the instance (repopulates DB-side onupdate columns like
        updated_at) so later synchronous attribute access won't trigger a lazy
        load in an async context (MissingGreenlet)."""
        await self._session.refresh(user)

    async def update_full_name(self, user: User, full_name: str) -> None:
        user.full_name = full_name
        await self._session.flush()


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


class SqlAlchemyEmailOtpRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def invalidate_unused(self, *, email: str, purpose: str) -> None:
        result = await self._session.execute(
            select(EmailOtpCode).where(
                func.lower(EmailOtpCode.email) == email.lower(),
                EmailOtpCode.purpose == purpose,
                EmailOtpCode.used.is_(False),
            )
        )
        for row in result.scalars().all():
            row.used = True
        await self._session.flush()

    async def create(
        self, *, email: str, purpose: str, code_hash: str, expires_at: datetime
    ) -> EmailOtpCode:
        row = EmailOtpCode(
            email=email.lower(),
            purpose=purpose,
            code_hash=code_hash,
            expires_at=expires_at,
            created_at=datetime.now(UTC),
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def get_active(self, *, email: str, purpose: str) -> EmailOtpCode | None:
        result = await self._session.execute(
            select(EmailOtpCode)
            .where(
                func.lower(EmailOtpCode.email) == email.lower(),
                EmailOtpCode.purpose == purpose,
                EmailOtpCode.used.is_(False),
                EmailOtpCode.expires_at > datetime.now(UTC),
            )
            .order_by(EmailOtpCode.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def increment_attempt(self, otp_id: uuid.UUID) -> int:
        row = await self._session.get(EmailOtpCode, otp_id)
        if row is None:
            return 0
        row.attempt_count += 1
        await self._session.flush()
        return row.attempt_count

    async def mark_used(self, otp_id: uuid.UUID) -> None:
        row = await self._session.get(EmailOtpCode, otp_id)
        if row is not None:
            row.used = True
            await self._session.flush()

    async def count_recent(self, *, email: str, purpose: str, since: datetime) -> int:
        result = await self._session.scalar(
            select(func.count())
            .select_from(EmailOtpCode)
            .where(
                func.lower(EmailOtpCode.email) == email.lower(),
                EmailOtpCode.purpose == purpose,
                EmailOtpCode.created_at >= since,
            )
        )
        return int(result or 0)


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
