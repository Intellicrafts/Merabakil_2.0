"""Tests for citizen profile and avatar APIs."""

from __future__ import annotations

import io
import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.api import deps
from app.application.use_cases import AuthResult, AuthService, GoogleNeedsRoleResult
from app.config import get_settings
from app.main import app
from legalos_common.security import create_access_token
from tests.fakes import (
    FakeOAuthIdentityRepository,
    FakePasswordResetRepository,
    FakeRefreshTokenRepository,
    FakeUserConsentRepository,
    FakeUserRepository,
)


def _png_bytes() -> bytes:
    img = Image.new("RGB", (800, 600), color=(120, 80, 40))
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


class InMemoryAvatarStore:
    def __init__(self) -> None:
        self.files: dict[str, bytes] = {}

    async def ensure_ready(self) -> None:
        return None

    async def save(self, user_id: uuid.UUID, raw: bytes, content_type: str) -> str:
        from app.infrastructure.avatar_store import avatar_storage_key

        key = avatar_storage_key(user_id)
        self.files[key] = raw
        return f"storage://{key}"

    async def load(self, storage_ref: str) -> tuple[bytes, str]:
        key = storage_ref.removeprefix("storage://")
        return self.files[key], "image/webp"

    async def delete(self, storage_ref: str) -> None:
        key = storage_ref.removeprefix("storage://")
        self.files.pop(key, None)


@pytest.fixture
def avatar_store() -> InMemoryAvatarStore:
    return InMemoryAvatarStore()


@pytest.fixture
def auth_service(avatar_store: InMemoryAvatarStore) -> AuthService:
    return AuthService(
        users=FakeUserRepository(),
        oauth_identities=FakeOAuthIdentityRepository(),
        refresh_tokens=FakeRefreshTokenRepository(),
        password_resets=FakePasswordResetRepository(),
        consents=FakeUserConsentRepository(),
        settings=get_settings(),
        avatar_store=avatar_store,  # type: ignore[arg-type]
    )


def _auth_header(user_id: str, roles: list[str]) -> dict[str, str]:
    token = create_access_token(user_id, roles=roles, permissions=[])
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def profile_client(auth_service: AuthService):
    app.dependency_overrides[deps.get_auth_service] = lambda: auth_service
    app.dependency_overrides[deps.enforce_rate_limit] = lambda: None
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_citizen_profile_get_and_patch(
    profile_client: AsyncClient, auth_service: AuthService
) -> None:
    reg = await auth_service.register(
        email="citizen@example.com", full_name="Citizen User", password="StrongPass1"
    )
    headers = _auth_header(reg.user_id, reg.roles)

    res = await profile_client.get("/api/v1/users/me/profile", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "citizen@example.com"
    assert body["full_name"] == "Citizen User"

    patch = await profile_client.patch(
        "/api/v1/users/me/profile",
        headers=headers,
        json={"full_name": "Updated Name", "phone": "+91 98765 43210", "address": "Delhi"},
    )
    assert patch.status_code == 200
    updated = patch.json()
    assert updated["full_name"] == "Updated Name"
    assert updated["phone"] == "+91 98765 43210"
    assert updated["address"] == "Delhi"


@pytest.mark.asyncio
async def test_citizen_profile_auto_created_when_missing(
    profile_client: AsyncClient, auth_service: AuthService
) -> None:
    user = await auth_service._users.create(  # noqa: SLF001
        email="legacy@example.com",
        full_name="Legacy Citizen",
        hashed_password="hash",
    )
    await auth_service._users.assign_roles(user, ["citizen"])  # noqa: SLF001
    headers = _auth_header(str(user.id), ["citizen"])

    res = await profile_client.get("/api/v1/users/me/profile", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["email"] == "legacy@example.com"
    assert body["full_name"] == "Legacy Citizen"


@pytest.mark.asyncio
async def test_advocate_cannot_access_citizen_profile(
    profile_client: AsyncClient, auth_service: AuthService
) -> None:
    reg = await auth_service.register(
        email="adv@example.com",
        full_name="Advocate User",
        password="StrongPass1",
        role="advocate",
    )
    headers = _auth_header(reg.user_id, reg.roles)
    res = await profile_client.get("/api/v1/users/me/profile", headers=headers)
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_avatar_upload_and_delete(
    profile_client: AsyncClient, auth_service: AuthService
) -> None:
    reg = await auth_service.register(
        email="photo@example.com", full_name="Photo User", password="StrongPass1"
    )
    headers = _auth_header(reg.user_id, reg.roles)

    files = {"file": ("avatar.png", _png_bytes(), "image/png")}
    upload = await profile_client.post("/api/v1/users/me/avatar", headers=headers, files=files)
    assert upload.status_code == 200
    avatar_url = upload.json()["avatar_url"]
    assert avatar_url.startswith("/api/v1/users/me/avatar")

    me = await profile_client.get("/api/v1/users/me", headers=headers)
    assert me.json()["avatar_url"] == avatar_url

    stream = await profile_client.get("/api/v1/users/me/avatar", headers=headers)
    assert stream.status_code == 200
    assert stream.headers["content-type"].startswith("image/")

    delete = await profile_client.delete("/api/v1/users/me/avatar", headers=headers)
    assert delete.status_code == 200


@pytest.mark.asyncio
async def test_google_login_sets_avatar_when_empty(auth_service: AuthService) -> None:
    from unittest.mock import patch

    from app.infrastructure.google_oauth import GoogleProfile

    user = await auth_service._users.create(
        email="linked@example.com", full_name="Linked", hashed_password=None, is_verified=True
    )
    await auth_service._users.assign_roles(user, ["citizen"])
    await auth_service._users.create_role_profile(user, "citizen")
    await auth_service._oauth_identities.create(
        user_id=user.id,
        provider="google",
        provider_user_id="sub-1",
        email=user.email,
    )

    profile = GoogleProfile(
        sub="sub-1",
        email=user.email,
        full_name=user.full_name,
        picture="https://example.com/picture.jpg",
        email_verified=True,
    )
    with patch.object(auth_service, "_verify_google_token", return_value=profile):
        result = await auth_service.authenticate_with_google(id_token="fake")

    assert isinstance(result, AuthResult)
    refreshed = await auth_service.get_user(uuid.UUID(result.user_id))
    assert refreshed.avatar_url == "https://example.com/picture.jpg"
