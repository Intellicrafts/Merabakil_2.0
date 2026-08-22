"""Unit + API tests for the auth flows (DB-free, in-memory fakes)."""

from __future__ import annotations

import uuid

import pytest

from app.application.use_cases import AuthService
from legalos_common.api.errors import ConflictError, UnauthorizedError


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
    # Old token is now revoked.
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
