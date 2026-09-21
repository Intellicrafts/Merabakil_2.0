from __future__ import annotations

from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api import deps
from app.application.use_cases import AuthResult, AuthService
from app.config import get_settings
from app.main import app
from tests.fakes import (
    FakeEmailOtpRepository,
    FakeOAuthIdentityRepository,
    FakePasswordResetRepository,
    FakeRefreshTokenRepository,
    FakeUserConsentRepository,
    FakeUserRepository,
)

TEST_OTP = "482910"


async def register_user(
    auth_service: AuthService,
    *,
    email: str,
    full_name: str = "Test User",
    password: str = "StrongPass1",
    role: str = "citizen",
    otp_code: str = TEST_OTP,
) -> AuthResult:
    with patch.object(auth_service, "_generate_otp", return_value=otp_code):
        await auth_service.send_otp(email=email, purpose="register")
    verified = await auth_service.verify_otp(email=email, purpose="register", code=otp_code)
    return await auth_service.register(
        email=email,
        full_name=full_name,
        password=password,
        verification_token=verified.verification_token,
        role=role,
    )


@pytest.fixture
def auth_service() -> AuthService:
    return AuthService(
        users=FakeUserRepository(),
        oauth_identities=FakeOAuthIdentityRepository(),
        refresh_tokens=FakeRefreshTokenRepository(),
        password_resets=FakePasswordResetRepository(),
        email_otps=FakeEmailOtpRepository(),
        consents=FakeUserConsentRepository(),
        settings=get_settings(),
    )


@pytest_asyncio.fixture
async def client(auth_service: AuthService) -> AsyncClient:
    app.dependency_overrides[deps.get_auth_service] = lambda: auth_service
    app.dependency_overrides[deps.enforce_rate_limit] = lambda: None
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
