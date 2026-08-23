"""Auth use cases (Service Layer). Pure orchestration over repositories."""

from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from jose import JWTError

from app.application.ports import (
    OAuthIdentityRepository,
    PasswordResetRepository,
    RefreshTokenRepository,
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
from legalos_common.api.errors import ConflictError, NotFoundError, UnauthorizedError
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


class AuthService:
    """Implements register/login/refresh/password-reset business rules."""

    def __init__(
        self,
        *,
        users: UserRepository,
        oauth_identities: OAuthIdentityRepository,
        refresh_tokens: RefreshTokenRepository,
        password_resets: PasswordResetRepository,
        settings: AuthSettings,
    ) -> None:
        self._users = users
        self._oauth_identities = oauth_identities
        self._refresh_tokens = refresh_tokens
        self._password_resets = password_resets
        self._settings = settings

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

    async def _login_user(self, user) -> AuthResult:
        if not user.is_active:
            raise UnauthorizedError("Account is disabled")
        if not user.role_names:
            raise UnauthorizedError("Account setup is incomplete. Please contact support.")
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

    # ---- use cases ------------------------------------------------------- #
    async def register(
        self, *, email: str, full_name: str, password: str, role: str = "citizen"
    ) -> AuthResult:
        if await self._users.get_by_email(email):
            raise ConflictError("A user with this email already exists")
        user = await self._users.create(
            email=email, full_name=full_name, hashed_password=hash_password(password)
        )
        await self._users.assign_roles(user, [role])
        await self._users.create_role_profile(user, role)
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
            return await self._login_user(user)

        user = await self._users.get_by_email(profile.email)
        if user is not None:
            await self._link_google_identity(user, profile)
            logger.info("google_auth.link_login user_id=%s", user.id)
            return await self._login_user(user)

        logger.info("google_auth.needs_role email=%s", profile.email)
        return GoogleNeedsRoleResult(
            status="needs_role",
            onboarding_token=create_onboarding_token(profile),
            email=profile.email,
            full_name=profile.full_name,
            picture=profile.picture,
        )

    async def complete_google_registration(
        self, *, onboarding_token: str, role: str
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

        refreshed = await self._users.get_by_id(user.id)
        assert refreshed is not None
        logger.info("google_auth.signup user_id=%s role=%s", refreshed.id, role)
        tokens = await self._issue_tokens(refreshed)
        return self._to_result(refreshed, tokens)

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

    async def list_users(self, *, offset: int, limit: int):
        return await self._users.list_users(offset=offset, limit=limit)
