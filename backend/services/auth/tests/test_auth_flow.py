"""Unit + API tests for the auth flows (DB-free, in-memory fakes)."""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest

from app.application.use_cases import AuthService, GoogleNeedsRoleResult
from app.infrastructure.google_oauth import GoogleProfile
from legalos_common.api.errors import ConflictError, UnauthorizedError


def _google_profile(**overrides) -> GoogleProfile:
    defaults = {
        "sub": "google-sub-123",
        "email": "google@example.com",
        "full_name": "Google User",
        "picture": "https://example.com/avatar.png",
        "email_verified": True,
    }
    defaults.update(overrides)
    return GoogleProfile(**defaults)


@pytest.mark.asyncio
async def test_register_and_authenticate(auth_service: AuthService) -> None:
    result = await auth_service.register(
        email="user@example.com", full_name="Test User", password="StrongPass1"
    )
    assert result.email == "user@example.com"
    assert "citizen" in result.roles
    assert result.tokens.access_token

    users = auth_service._users
    assert users.profile_roles[uuid.UUID(result.user_id)] == "citizen"

    auth = await auth_service.authenticate(email="user@example.com", password="StrongPass1")
    assert auth.user_id == result.user_id


@pytest.mark.asyncio
@pytest.mark.parametrize("role", ["advocate", "law_firm", "enterprise"])
async def test_registration_creates_matching_role_profile(
    auth_service: AuthService, role: str
) -> None:
    result = await auth_service.register(
        email=f"{role}@example.com",
        full_name=f"{role} account",
        password="StrongPass1",
        role=role,
    )

    users = auth_service._users
    assert users.profile_roles[uuid.UUID(result.user_id)] == role


@pytest.mark.asyncio
async def test_duplicate_registration_conflicts(auth_service: AuthService) -> None:
    await auth_service.register(email="dup@example.com", full_name="A", password="StrongPass1")
    with pytest.raises(ConflictError):
        await auth_service.register(email="dup@example.com", full_name="B", password="StrongPass1")


@pytest.mark.asyncio
async def test_bad_password_rejected(auth_service: AuthService) -> None:
    await auth_service.register(email="x@example.com", full_name="X", password="StrongPass1")
    with pytest.raises(UnauthorizedError):
        await auth_service.authenticate(email="x@example.com", password="wrong")


@pytest.mark.asyncio
async def test_refresh_rotation(auth_service: AuthService) -> None:
    reg = await auth_service.register(email="r@example.com", full_name="R", password="StrongPass1")
    pair = await auth_service.refresh(refresh_token=reg.tokens.refresh_token)
    assert pair.access_token
    with pytest.raises(UnauthorizedError):
        await auth_service.refresh(refresh_token=reg.tokens.refresh_token)


@pytest.mark.asyncio
async def test_password_reset_cycle(auth_service: AuthService) -> None:
    await auth_service.register(email="reset@example.com", full_name="R", password="StrongPass1")
    token = await auth_service.request_password_reset(email="reset@example.com")
    assert token is not None
    await auth_service.reset_password(token=token, new_password="BrandNewPass9")
    auth = await auth_service.authenticate(email="reset@example.com", password="BrandNewPass9")
    assert auth.email == "reset@example.com"


@pytest.mark.asyncio
async def test_api_register_login(client) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": "api@example.com", "full_name": "API User", "password": "StrongPass1"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user"]["email"] == "api@example.com"
    access = body["tokens"]["access_token"]

    me = await client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 200
    assert "research:read" in me.json()["permissions"]

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "api@example.com", "password": "StrongPass1"},
    )
    assert login.status_code == 200


@pytest.mark.asyncio
async def test_api_login_invalid(client) -> None:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "whatever1"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
@patch("app.application.use_cases.verify_google_id_token")
async def test_google_auth_new_user(mock_verify, auth_service: AuthService) -> None:
    mock_verify.return_value = _google_profile()
    auth_service._settings.google_oauth_client_id = "test-client-id.apps.googleusercontent.com"

    result = await auth_service.authenticate_with_google(id_token="fake-token")
    assert isinstance(result, GoogleNeedsRoleResult)
    assert result.status == "needs_role"
    assert result.email == "google@example.com"
    assert len(auth_service._users.store) == 0


@pytest.mark.asyncio
@patch("app.application.use_cases.verify_google_id_token")
async def test_google_complete_citizen(mock_verify, auth_service: AuthService) -> None:
    mock_verify.return_value = _google_profile()
    auth_service._settings.google_oauth_client_id = "test-client-id.apps.googleusercontent.com"

    needs = await auth_service.authenticate_with_google(id_token="fake-token")
    assert isinstance(needs, GoogleNeedsRoleResult)

    auth = await auth_service.complete_google_registration(
        onboarding_token=needs.onboarding_token,
        role="citizen",
    )
    assert auth.email == "google@example.com"
    assert "citizen" in auth.roles
    assert auth_service._users.profile_roles[uuid.UUID(auth.user_id)] == "citizen"
    assert len(auth_service._oauth_identities.store) == 1


@pytest.mark.asyncio
@patch("app.application.use_cases.verify_google_id_token")
async def test_google_complete_advocate(mock_verify, auth_service: AuthService) -> None:
    mock_verify.return_value = _google_profile(email="advocate.google@example.com", sub="sub-adv")
    auth_service._settings.google_oauth_client_id = "test-client-id.apps.googleusercontent.com"

    needs = await auth_service.authenticate_with_google(id_token="fake-token")
    assert isinstance(needs, GoogleNeedsRoleResult)

    auth = await auth_service.complete_google_registration(
        onboarding_token=needs.onboarding_token,
        role="advocate",
    )
    assert auth_service._users.profile_roles[uuid.UUID(auth.user_id)] == "advocate"


@pytest.mark.asyncio
@patch("app.application.use_cases.verify_google_id_token")
async def test_google_existing_user(mock_verify, auth_service: AuthService) -> None:
    profile = _google_profile()
    mock_verify.return_value = profile
    auth_service._settings.google_oauth_client_id = "test-client-id.apps.googleusercontent.com"

    reg = await auth_service.register(
        email="existing@example.com", full_name="Existing", password="StrongPass1"
    )
    user_id = uuid.UUID(reg.user_id)
    await auth_service._oauth_identities.create(
        user_id=user_id,
        provider="google",
        provider_user_id=profile.sub,
        email=profile.email,
    )

    mock_verify.return_value = _google_profile(email="existing@example.com")
    result = await auth_service.authenticate_with_google(id_token="fake-token")
    assert result.user_id == reg.user_id
    assert result.tokens.access_token


@pytest.mark.asyncio
@patch("app.application.use_cases.verify_google_id_token")
async def test_google_link_existing_email(mock_verify, auth_service: AuthService) -> None:
    mock_verify.return_value = _google_profile(email="linked@example.com", sub="sub-link")
    auth_service._settings.google_oauth_client_id = "test-client-id.apps.googleusercontent.com"

    reg = await auth_service.register(
        email="linked@example.com", full_name="Linked", password="StrongPass1"
    )
    result = await auth_service.authenticate_with_google(id_token="fake-token")
    assert result.user_id == reg.user_id
    assert len(auth_service._oauth_identities.store) == 1
    assert len(auth_service._users.store) == 1


@pytest.mark.asyncio
async def test_google_invalid_token(auth_service: AuthService) -> None:
    auth_service._settings.google_oauth_client_id = "test-client-id.apps.googleusercontent.com"
    with pytest.raises(UnauthorizedError):
        await auth_service.authenticate_with_google(id_token="not-a-valid-token")


@pytest.mark.asyncio
@patch("app.application.use_cases.verify_google_id_token")
async def test_google_expired_onboarding_token(mock_verify, auth_service: AuthService) -> None:
    mock_verify.return_value = _google_profile()
    auth_service._settings.google_oauth_client_id = "test-client-id.apps.googleusercontent.com"

    with pytest.raises(UnauthorizedError):
        await auth_service.complete_google_registration(
            onboarding_token="invalid.onboarding.token",
            role="citizen",
        )


@pytest.mark.asyncio
@patch("app.application.use_cases.verify_google_id_token")
async def test_api_google_needs_role(mock_verify, client, auth_service: AuthService) -> None:
    mock_verify.return_value = _google_profile()
    auth_service._settings.google_oauth_client_id = "test-client-id.apps.googleusercontent.com"

    resp = await client.post("/api/v1/auth/google", json={"id_token": "fake-token"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "needs_role"
    assert body["onboarding_token"]


@pytest.mark.asyncio
@patch("app.application.use_cases.verify_google_id_token")
async def test_api_google_complete(mock_verify, client, auth_service: AuthService) -> None:
    mock_verify.return_value = _google_profile(email="api.google@example.com", sub="api-sub")
    auth_service._settings.google_oauth_client_id = "test-client-id.apps.googleusercontent.com"

    needs = await client.post("/api/v1/auth/google", json={"id_token": "fake-token"})
    token = needs.json()["onboarding_token"]

    resp = await client.post(
        "/api/v1/auth/google/complete",
        json={"onboarding_token": token, "role": "citizen"},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["user"]["email"] == "api.google@example.com"
    assert body["tokens"]["access_token"]
