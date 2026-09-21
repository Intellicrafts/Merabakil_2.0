"""OTP send/verify flows for registration and login."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.application.use_cases import AuthService
from legalos_common.api.errors import ConflictError, UnauthorizedError, ValidationFailedError
from tests.conftest import TEST_OTP, register_user


class _FailingEmailClient:
    async def send(self, **kwargs) -> bool:
        return False

    def validate_config(self) -> list[str]:
        return []

    def is_configured(self) -> bool:
        return True

    last_error = "smtp failed"


@pytest.mark.asyncio
async def test_register_otp_cycle(auth_service: AuthService) -> None:
    with patch.object(auth_service, "_generate_otp", return_value=TEST_OTP):
        await auth_service.send_otp(email="otp-user@example.com", purpose="register")

    verified = await auth_service.verify_otp(
        email="otp-user@example.com", purpose="register", code=TEST_OTP
    )
    result = await auth_service.register(
        email="otp-user@example.com",
        full_name="OTP User",
        password="StrongPass1",
        verification_token=verified.verification_token,
    )
    assert result.email == "otp-user@example.com"

    user = await auth_service._users.get_by_email("otp-user@example.com")  # noqa: SLF001
    assert user is not None
    assert user.is_verified is True


@pytest.mark.asyncio
async def test_register_without_verification_token_rejected(auth_service: AuthService) -> None:
    with pytest.raises(UnauthorizedError):
        await auth_service.register(
            email="no-token@example.com",
            full_name="No Token",
            password="StrongPass1",
            verification_token="invalid.token.value",
        )


@pytest.mark.asyncio
async def test_register_duplicate_email_on_send(auth_service: AuthService) -> None:
    await register_user(auth_service, email="dup-send@example.com")
    with pytest.raises(ConflictError):
        await auth_service.send_otp(email="dup-send@example.com", purpose="register")


@pytest.mark.asyncio
async def test_login_otp_cycle(auth_service: AuthService) -> None:
    reg = await register_user(auth_service, email="login-otp@example.com")
    with patch.object(auth_service, "_generate_otp", return_value=TEST_OTP):
        await auth_service.send_otp(email="login-otp@example.com", purpose="login")

    auth = await auth_service.verify_otp(
        email="login-otp@example.com", purpose="login", code=TEST_OTP
    )
    assert auth.user_id == reg.user_id
    assert auth.tokens.access_token


@pytest.mark.asyncio
async def test_login_otp_unknown_email_generic_send(auth_service: AuthService) -> None:
    sent = await auth_service.send_otp(email="missing@example.com", purpose="login")
    assert sent.message == "If the account exists, a sign-in code has been sent."
    with pytest.raises(UnauthorizedError):
        await auth_service.verify_otp(
            email="missing@example.com", purpose="login", code="123456"
        )


@pytest.mark.asyncio
async def test_otp_invalid_code(auth_service: AuthService) -> None:
    with patch.object(auth_service, "_generate_otp", return_value=TEST_OTP):
        await auth_service.send_otp(email="bad-code@example.com", purpose="register")
    with pytest.raises(UnauthorizedError):
        await auth_service.verify_otp(
            email="bad-code@example.com", purpose="register", code="000000"
        )


@pytest.mark.asyncio
async def test_otp_max_attempts_lockout(auth_service: AuthService) -> None:
    with patch.object(auth_service, "_generate_otp", return_value=TEST_OTP):
        await auth_service.send_otp(email="lockout@example.com", purpose="register")
    for _ in range(5):
        with pytest.raises(UnauthorizedError):
            await auth_service.verify_otp(
                email="lockout@example.com", purpose="register", code="000000"
            )
    with pytest.raises(UnauthorizedError):
        await auth_service.verify_otp(
            email="lockout@example.com", purpose="register", code=TEST_OTP
        )


@pytest.mark.asyncio
async def test_otp_send_rate_limit(auth_service: AuthService) -> None:
    email = "rate-limit@example.com"
    for _ in range(3):
        with patch.object(auth_service, "_generate_otp", return_value=TEST_OTP):
            await auth_service.send_otp(email=email, purpose="register")
    with pytest.raises(ValidationFailedError):
        await auth_service.send_otp(email=email, purpose="register")


@pytest.mark.asyncio
async def test_api_register_with_otp(client, auth_service: AuthService) -> None:
    with patch.object(auth_service, "_generate_otp", return_value=TEST_OTP):
        send = await client.post(
            "/api/v1/auth/otp/send",
            json={"email": "api-otp@example.com", "purpose": "register"},
        )
    assert send.status_code == 200, send.text
    assert "dev_otp" not in send.json()

    verify = await client.post(
        "/api/v1/auth/otp/verify",
        json={"email": "api-otp@example.com", "purpose": "register", "code": TEST_OTP},
    )
    assert verify.status_code == 200, verify.text
    verification_token = verify.json()["verification_token"]

    register = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "api-otp@example.com",
            "full_name": "API OTP User",
            "password": "StrongPass1",
            "verification_token": verification_token,
        },
    )
    assert register.status_code == 201, register.text
    assert register.json()["user"]["email"] == "api-otp@example.com"


@pytest.mark.asyncio
async def test_send_otp_fails_when_email_send_fails(auth_service: AuthService) -> None:
    auth_service._email = _FailingEmailClient()  # noqa: SLF001
    with pytest.raises(ValidationFailedError, match="Unable to send verification email"):
        await auth_service.send_otp(email="fail@example.com", purpose="register")


@pytest.mark.asyncio
async def test_send_otp_awaits_email_client(auth_service: AuthService) -> None:
    mock_email = MagicMock()
    mock_email.send = AsyncMock(return_value=True)
    mock_email.validate_config = MagicMock(return_value=[])
    mock_email.is_configured = MagicMock(return_value=True)
    auth_service._email = mock_email  # noqa: SLF001

    await auth_service.send_otp(email="await@example.com", purpose="register")
    mock_email.send.assert_awaited_once()


@pytest.mark.asyncio
async def test_api_login_with_otp(client, auth_service: AuthService) -> None:
    reg = await register_user(auth_service, email="api-login-otp@example.com")
    with patch.object(auth_service, "_generate_otp", return_value=TEST_OTP):
        send = await client.post(
            "/api/v1/auth/otp/send",
            json={"email": "api-login-otp@example.com", "purpose": "login"},
        )
    assert send.status_code == 200, send.text
    assert "dev_otp" not in send.json()

    verify = await client.post(
        "/api/v1/auth/otp/verify",
        json={"email": "api-login-otp@example.com", "purpose": "login", "code": TEST_OTP},
    )
    assert verify.status_code == 200, verify.text
    body = verify.json()
    assert body["user"]["user_id"] == reg.user_id
    assert body["tokens"]["access_token"]
