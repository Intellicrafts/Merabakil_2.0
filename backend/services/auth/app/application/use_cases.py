"""Auth use cases (Service Layer). Pure orchestration over repositories."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from jose import JWTError

from app.application.ports import (
    OAuthIdentityRepository,
    PasswordResetRepository,
    RefreshTokenRepository,
    UserConsentRepository,
    UserRepository,
)
from app.config import AuthSettings
from app.infrastructure.google_oauth import (
    GOOGLE_PROVIDER,
    GoogleProfile,
    create_onboarding_token,
    decode_onboarding_token,
    verify_google_id_token,
)
from app.infrastructure.avatar_store import (
    AvatarStore,
    get_avatar_store,
    is_external_avatar_url,
    is_stored_avatar_url,
)
from legalos_common.api.errors import ConflictError, NotFoundError, UnauthorizedError, ValidationFailedError
from legalos_common.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from legalos_common.security.jwt import TokenPayload

logger = logging.getLogger(__name__)

_SELF_SERVICE_ROLES = {"citizen", "advocate", "law_firm", "enterprise"}
_PHONE_PATTERN = re.compile(r"^[\d+\s\-()]{0,30}$")


@dataclass(slots=True)
class TokenPair:
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@dataclass(slots=True)
class AuthResult:
    user_id: str
    email: str
    full_name: str
    roles: list[str]
    permissions: list[str]
    tokens: TokenPair


@dataclass(slots=True)
class GoogleNeedsRoleResult:
    status: str
    onboarding_token: str
    email: str
    full_name: str
    picture: str | None


@dataclass(slots=True)
class CitizenProfileResult:
    full_name: str
    email: str
    phone: str | None
    date_of_birth: date | None
    address: str | None
    avatar_url: str | None


class AuthService:
    """Implements register/login/refresh/password-reset business rules."""

    def __init__(
        self,
        *,
        users: UserRepository,
        oauth_identities: OAuthIdentityRepository,
        refresh_tokens: RefreshTokenRepository,
        password_resets: PasswordResetRepository,
        consents: UserConsentRepository,
        settings: AuthSettings,
        events=None,
        email_client=None,
        avatar_store: AvatarStore | None = None,
    ) -> None:
        self._users = users
        self._oauth_identities = oauth_identities
        self._refresh_tokens = refresh_tokens
        self._password_resets = password_resets
        self._consents = consents
        self._settings = settings
        self._events = events
        self._email = email_client
        self._avatars = avatar_store or get_avatar_store()

    # ---- token helpers --------------------------------------------------- #
    async def _issue_tokens(self, user) -> TokenPair:
        access = create_access_token(
            str(user.id), roles=user.role_names, permissions=user.permission_codes
        )
        refresh = create_refresh_token(str(user.id))
        payload = decode_token(refresh, expected_type=TokenType.REFRESH)
        await self._refresh_tokens.store(
            user_id=user.id,
            jti=payload.jti,
            expires_at=datetime.fromtimestamp(payload.exp, tz=UTC),
        )
        return TokenPair(access_token=access, refresh_token=refresh)

    def _to_result(self, user, tokens: TokenPair) -> AuthResult:
        return AuthResult(
            user_id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            roles=user.role_names,
            permissions=user.permission_codes,
            tokens=tokens,
        )

    def resolve_avatar_url(self, user) -> str | None:
        raw = getattr(user, "avatar_url", None)
        if not raw:
            return None
        if is_external_avatar_url(raw):
            return raw
        if is_stored_avatar_url(raw):
            version = ""
            updated_at = getattr(user, "updated_at", None)
            if updated_at is not None:
                version = f"?v={int(updated_at.timestamp())}"
            return f"/api/v1/users/me/avatar{version}"
        return raw

    async def _maybe_set_google_avatar(self, user, picture: str | None) -> None:
        if not picture or getattr(user, "avatar_url", None):
            return
        await self._users.update_avatar_url(user, picture.strip())

    def _validate_date_of_birth(self, dob: date | None) -> None:
        if dob is None:
            return
        today = datetime.now(UTC).date()
        if dob > today:
            raise ValidationFailedError("Date of birth cannot be in the future")
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        if age < 13:
            raise ValidationFailedError("You must be at least 13 years old")

    def _validate_phone(self, phone: str | None) -> None:
        if phone is None:
            return
        trimmed = phone.strip()
        if trimmed and not _PHONE_PATTERN.match(trimmed):
            raise ValidationFailedError("Invalid phone number format")

    async def _login_user(self, user, *, google_picture: str | None = None) -> AuthResult:
        if not user.is_active:
            raise UnauthorizedError("Account is disabled")
        if not user.role_names:
            raise UnauthorizedError("Account setup is incomplete. Please contact support.")
        if google_picture:
            await self._maybe_set_google_avatar(user, google_picture)
        tokens = await self._issue_tokens(user)
        return self._to_result(user, tokens)

    def _verify_google_token(self, id_token_str: str) -> GoogleProfile:
        client_id = self._settings.google_oauth_client_id
        if not client_id:
            raise UnauthorizedError("Google sign-in is not configured")
        try:
            return verify_google_id_token(id_token_str, client_id=client_id)
        except ValueError as exc:
            raise UnauthorizedError("Invalid Google token") from exc

    async def _link_google_identity(self, user, profile: GoogleProfile) -> None:
        existing = await self._oauth_identities.get_by_provider_user(
            provider=GOOGLE_PROVIDER, provider_user_id=profile.sub
        )
        if existing is None:
            await self._oauth_identities.create(
                user_id=user.id,
                provider=GOOGLE_PROVIDER,
                provider_user_id=profile.sub,
                email=profile.email,
            )
            logger.info("google_auth.link user_id=%s", user.id)

    async def _record_registration_consents(
        self,
        user_id: uuid.UUID,
        *,
        terms_version: str | None,
        privacy_version: str | None,
        ip_hash: str | None = None,
    ) -> None:
        if terms_version:
            await self._consents.record(
                user_id=user_id,
                consent_type="terms",
                version=terms_version,
                ip_hash=ip_hash,
            )
        if privacy_version:
            await self._consents.record(
                user_id=user_id,
                consent_type="privacy",
                version=privacy_version,
                ip_hash=ip_hash,
            )

    # ---- use cases ------------------------------------------------------- #
    async def register(
        self,
        *,
        email: str,
        full_name: str,
        password: str,
        role: str = "citizen",
        terms_version: str | None = None,
        privacy_version: str | None = None,
        ip_hash: str | None = None,
    ) -> AuthResult:
        if await self._users.get_by_email(email):
            raise ConflictError("A user with this email already exists")
        user = await self._users.create(
            email=email, full_name=full_name, hashed_password=hash_password(password)
        )
        await self._users.assign_roles(user, [role])
        await self._users.create_role_profile(user, role)
        await self._record_registration_consents(
            user.id,
            terms_version=terms_version,
            privacy_version=privacy_version,
            ip_hash=ip_hash,
        )
        if self._events is not None:
            await self._events.publish_user_registered(user_id=str(user.id), role=role)
        if self._email is not None:
            from legalos_common.email.templates import welcome_email
            subject, html, text = welcome_email(
                user.full_name, role, frontend_url=self._settings.frontend_url
            )
            asyncio.create_task(
                self._email.send(
                    to_email=user.email,
                    to_name=user.full_name,
                    subject=subject,
                    html=html,
                    text=text,
                )
            )
        refreshed = await self._users.get_by_id(user.id)
        assert refreshed is not None
        tokens = await self._issue_tokens(refreshed)
        return self._to_result(refreshed, tokens)

    async def authenticate(self, *, email: str, password: str) -> AuthResult:
        user = await self._users.get_by_email(email)
        if user is None or not user.hashed_password:
            raise UnauthorizedError("Invalid email or password")
        if not verify_password(password, user.hashed_password):
            raise UnauthorizedError("Invalid email or password")
        return await self._login_user(user)

    async def authenticate_with_google(
        self, *, id_token: str
    ) -> AuthResult | GoogleNeedsRoleResult:
        profile = self._verify_google_token(id_token)

        identity = await self._oauth_identities.get_by_provider_user(
            provider=GOOGLE_PROVIDER, provider_user_id=profile.sub
        )
        if identity is not None:
            user = await self._users.get_by_id(identity.user_id)
            if user is None:
                raise UnauthorizedError("Linked account not found")
            logger.info("google_auth.login user_id=%s", user.id)
            return await self._login_user(user, google_picture=profile.picture)

        user = await self._users.get_by_email(profile.email)
        if user is not None:
            await self._link_google_identity(user, profile)
            logger.info("google_auth.link_login user_id=%s", user.id)
            return await self._login_user(user, google_picture=profile.picture)

        logger.info("google_auth.needs_role email=%s", profile.email)
        return GoogleNeedsRoleResult(
            status="needs_role",
            onboarding_token=create_onboarding_token(profile),
            email=profile.email,
            full_name=profile.full_name,
            picture=profile.picture,
        )

    async def complete_google_registration(
        self,
        *,
        onboarding_token: str,
        role: str,
        terms_version: str | None = None,
        privacy_version: str | None = None,
        ip_hash: str | None = None,
    ) -> AuthResult:
        if role not in _SELF_SERVICE_ROLES:
            raise ConflictError("Invalid role for self-service registration")

        try:
            payload = decode_onboarding_token(onboarding_token)
        except JWTError as exc:
            raise UnauthorizedError("Invalid or expired onboarding token") from exc

        existing_identity = await self._oauth_identities.get_by_provider_user(
            provider=GOOGLE_PROVIDER, provider_user_id=payload.google_sub
        )
        if existing_identity is not None:
            user = await self._users.get_by_id(existing_identity.user_id)
            if user is None:
                raise UnauthorizedError("Linked account not found")
            return await self._login_user(user)

        if await self._users.get_by_email(payload.email):
            raise ConflictError("An account with this email already exists")

        user = await self._users.create(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=None,
            is_verified=True,
        )
        await self._oauth_identities.create(
            user_id=user.id,
            provider=GOOGLE_PROVIDER,
            provider_user_id=payload.google_sub,
            email=payload.email,
        )
        await self._users.assign_roles(user, [role])
        await self._users.create_role_profile(user, role)
        if payload.picture:
            await self._users.update_avatar_url(user, payload.picture.strip())
        await self._record_registration_consents(
            user.id,
            terms_version=terms_version,
            privacy_version=privacy_version,
            ip_hash=ip_hash,
        )
        if self._events is not None:
            await self._events.publish_user_registered(user_id=str(user.id), role=role)
        if self._email is not None:
            from legalos_common.email.templates import welcome_email
            subject, html, text = welcome_email(
                user.full_name, role, frontend_url=self._settings.frontend_url
            )
            asyncio.create_task(
                self._email.send(
                    to_email=user.email,
                    to_name=user.full_name,
                    subject=subject,
                    html=html,
                    text=text,
                )
            )

        refreshed = await self._users.get_by_id(user.id)
        assert refreshed is not None
        logger.info("google_auth.signup user_id=%s role=%s", refreshed.id, role)
        tokens = await self._issue_tokens(refreshed)
        return self._to_result(refreshed, tokens)

    async def list_user_consents(self, user_id: uuid.UUID):
        return await self._consents.list_for_user(user_id)

    async def refresh(self, *, refresh_token: str) -> TokenPair:
        try:
            payload: TokenPayload = decode_token(refresh_token, expected_type=TokenType.REFRESH)
        except Exception as exc:
            raise UnauthorizedError("Invalid refresh token") from exc

        stored = await self._refresh_tokens.get_active(payload.jti)
        if stored is None:
            raise UnauthorizedError("Refresh token revoked or unknown")

        user = await self._users.get_by_id(uuid.UUID(payload.sub))
        if user is None:
            raise UnauthorizedError("User no longer exists")

        await self._refresh_tokens.revoke(payload.jti)
        return await self._issue_tokens(user)

    async def request_password_reset(self, *, email: str) -> str | None:
        """Return a reset token (delivered out-of-band in production via email)."""
        user = await self._users.get_by_email(email)
        if user is None:
            return None
        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        await self._password_resets.create(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
        )
        if self._email is not None:
            from legalos_common.email.templates import password_reset_email
            reset_url = f"{self._settings.frontend_url}/reset-password?token={raw_token}"
            subject, html, text = password_reset_email(
                user.full_name, reset_url, frontend_url=self._settings.frontend_url
            )
            asyncio.create_task(
                self._email.send(
                    to_email=user.email,
                    to_name=user.full_name,
                    subject=subject,
                    html=html,
                    text=text,
                )
            )
        return raw_token

    async def reset_password(self, *, token: str, new_password: str) -> None:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        user_id = await self._password_resets.consume(token_hash)
        if user_id is None:
            raise UnauthorizedError("Invalid or expired reset token")
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found")
        await self._users.update_password(user, hash_password(new_password))

    async def get_user(self, user_id: uuid.UUID):
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    async def list_users(
        self,
        *,
        offset: int,
        limit: int,
        search: str | None = None,
        is_active: bool | None = None,
        role: str | None = None,
    ):
        return await self._users.list_users(
            offset=offset, limit=limit, search=search, is_active=is_active, role=role
        )

    async def update_user(
        self,
        user_id: uuid.UUID,
        *,
        full_name: str | None,
        is_active: bool | None,
    ):
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found")
        return await self._users.update_user(user, full_name=full_name, is_active=is_active)

    async def _get_or_create_citizen_profile_row(self, user_id: uuid.UUID):
        user = await self.get_user(user_id)
        if "citizen" not in user.role_names:
            raise UnauthorizedError("Citizen profile is only available for citizen accounts")
        row = await self._users.get_citizen_profile(user_id)
        if row is None:
            profile = await self._users.create_role_profile(user, "citizen")
            if profile is None:
                raise NotFoundError("Citizen profile not found")
            row = (user, profile)
        return row

    async def get_citizen_profile(self, user_id: uuid.UUID) -> CitizenProfileResult:
        profile_user, profile = await self._get_or_create_citizen_profile_row(user_id)
        return CitizenProfileResult(
            full_name=profile_user.full_name,
            email=profile_user.email,
            phone=profile.phone,
            date_of_birth=profile.date_of_birth,
            address=profile.address,
            avatar_url=self.resolve_avatar_url(profile_user),
        )

    async def update_citizen_profile(
        self,
        user_id: uuid.UUID,
        *,
        full_name: str | None = None,
        phone: str | None = None,
        date_of_birth: date | None = None,
        address: str | None = None,
        fields_set: set[str] | None = None,
    ) -> CitizenProfileResult:
        profile_user, profile = await self._get_or_create_citizen_profile_row(user_id)

        if fields_set and "phone" in fields_set:
            normalized_phone = phone.strip() if phone else None
            self._validate_phone(normalized_phone)
            phone = normalized_phone
        if fields_set and "date_of_birth" in fields_set:
            self._validate_date_of_birth(date_of_birth)
        if fields_set and "full_name" in fields_set and full_name is not None:
            full_name = full_name.strip()
            if not full_name:
                raise ValidationFailedError("Full name is required")

        await self._users.update_citizen_profile(
            profile_user,
            profile,
            full_name=full_name if fields_set and "full_name" in fields_set else None,
            phone=phone if fields_set and "phone" in fields_set else None,
            date_of_birth=date_of_birth if fields_set and "date_of_birth" in fields_set else None,
            address=address if fields_set and "address" in fields_set else None,
            clear_phone=bool(fields_set and "phone" in fields_set and not phone),
            clear_date_of_birth=bool(fields_set and "date_of_birth" in fields_set and date_of_birth is None),
            clear_address=bool(fields_set and "address" in fields_set and not address),
        )
        refreshed = await self._users.get_citizen_profile(user_id)
        assert refreshed is not None
        profile_user, profile = refreshed
        return CitizenProfileResult(
            full_name=profile_user.full_name,
            email=profile_user.email,
            phone=profile.phone,
            date_of_birth=profile.date_of_birth,
            address=profile.address,
            avatar_url=self.resolve_avatar_url(profile_user),
        )

    async def upload_avatar(
        self, user_id: uuid.UUID, *, raw: bytes, content_type: str
    ) -> str:
        user = await self.get_user(user_id)
        await self._avatars.ensure_ready()
        previous = getattr(user, "avatar_url", None)
        storage_ref = await self._avatars.save(user.id, raw, content_type)
        await self._users.update_avatar_url(user, storage_ref)
        if previous and is_stored_avatar_url(previous) and previous != storage_ref:
            try:
                await self._avatars.delete(previous)
            except Exception:
                logger.warning("avatar_cleanup_failed user_id=%s", user_id)
        refreshed = await self.get_user(user_id)
        return self.resolve_avatar_url(refreshed) or ""

    async def delete_avatar(self, user_id: uuid.UUID) -> None:
        user = await self.get_user(user_id)
        previous = getattr(user, "avatar_url", None)
        if previous and is_stored_avatar_url(previous):
            try:
                await self._avatars.delete(previous)
            except Exception:
                logger.warning("avatar_delete_failed user_id=%s", user_id)
        await self._users.update_avatar_url(user, None)

    async def get_avatar_file(self, user_id: uuid.UUID) -> tuple[bytes, str]:
        user = await self.get_user(user_id)
        raw = getattr(user, "avatar_url", None)
        if not raw or not is_stored_avatar_url(raw):
            raise NotFoundError("Avatar not found")
        return await self._avatars.load(raw)
