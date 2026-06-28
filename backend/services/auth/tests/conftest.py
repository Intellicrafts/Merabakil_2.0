from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api import deps
from app.application.use_cases import AuthService
from app.config import get_settings
from app.main import app
from tests.fakes import (
    FakePasswordResetRepository,
    FakeRefreshTokenRepository,
    FakeUserRepository,
)


@pytest.fixture
def auth_service() -> AuthService:
    return AuthService(
        users=FakeUserRepository(),
        refresh_tokens=FakeRefreshTokenRepository(),
        password_resets=FakePasswordResetRepository(),
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
