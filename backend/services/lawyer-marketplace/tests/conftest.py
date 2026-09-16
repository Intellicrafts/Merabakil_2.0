"""Shared fixtures for the lawyer-marketplace suite."""

from __future__ import annotations

import os
import sys
from collections import defaultdict
from unittest.mock import MagicMock

# Optional SMTP dependency — tests must not require a live mail stack.
sys.modules.setdefault("aiosmtplib", MagicMock())

import pytest
from fastapi.testclient import TestClient

from tests.helpers import auth, book


@pytest.fixture(autouse=True)
def clear_active_calls():
    from app.application import appointments as appt_mod

    appt_mod._ACTIVE_CALLS.clear()
    yield
    appt_mod._ACTIVE_CALLS.clear()


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("MARKETPLACE_NATIVE", "true")
    monkeypatch.setenv("MARKETPLACE_AUTO_CONFIRM", "true")
    monkeypatch.setenv("MARKETPLACE_DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path}/mp.db")
    monkeypatch.setenv("JWT_SECRET_KEY", os.getenv("JWT_SECRET_KEY", "dev-local-secret"))
    monkeypatch.setenv("APPOINTMENT_FILES_DIR", str(tmp_path / "files"))
    import app.infrastructure.db as dbmod

    dbmod._engine = None
    dbmod._sessionmaker = None
    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
    try:
        from app.application import appointments as appt_mod

        appt_mod._ACTIVE_CALLS.clear()
    except Exception:
        pass
    dbmod._engine = None
    dbmod._sessionmaker = None


@pytest.fixture()
def admin_auth() -> dict[str, str]:
    return auth("admin")


@pytest.fixture()
def citizen_auth() -> dict[str, str]:
    return auth("citizen")


@pytest.fixture()
def lawyer_auth() -> dict[str, str]:
    return auth("advocate")


@pytest.fixture()
def booked_appointment(client: TestClient) -> str:
    return book(client)


@pytest.fixture()
def live_appointment(client: TestClient) -> str:
    """An appointment both parties have joined, so it is `live` with real presence."""
    apt_id = book(client)
    for role in ("citizen", "advocate"):
        res = client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=auth(role))
        assert res.status_code == 200, res.text
    return apt_id


class FakeLiveKit:
    """In-memory stand-in for LiveKit Cloud, so room behaviour is deterministic in tests."""

    def __init__(self) -> None:
        self.rooms: dict[str, dict[str, dict]] = defaultdict(dict)
        self.minted: list[dict] = []
        self.removed: list[tuple[str, str]] = []
        self.updated: list[dict] = []
        self.url = "wss://test.livekit.cloud"

    def present(self, room: str, identity: str, **fields) -> None:
        """Seed a participant as already connected to `room`."""
        self.rooms[room][identity] = {"identity": identity, "hidden": False, **fields}

    def mint_room_token(self, *, room: str, identity: str, name: str, role: str):
        self.minted.append({"room": room, "identity": identity, "name": name, "role": role})
        return f"fake-token-{identity}", self.url

    def mint_observe_token(self, *, room: str, identity: str, name: str):
        self.minted.append({"room": room, "identity": identity, "name": name, "role": "admin"})
        return f"fake-observe-{identity}", self.url

    async def remove_room_participant(self, *, room: str, identity: str) -> bool:
        self.removed.append((room, identity))
        return self.rooms[room].pop(identity, None) is not None

    async def update_participant(self, *, room: str, identity: str, **permissions) -> bool:
        self.updated.append({"room": room, "identity": identity, **permissions})
        if identity not in self.rooms[room]:
            return False
        self.rooms[room][identity].update(permissions)
        return True

    async def list_participants(self, *, room: str) -> list[dict]:
        return list(self.rooms[room].values())


@pytest.fixture()
def fake_livekit(monkeypatch) -> FakeLiveKit:
    """Patch the LiveKit boundary. Patches the names bound into `marketplace_api`, since
    that module imports them directly."""
    fake = FakeLiveKit()
    monkeypatch.setenv("LIVEKIT_URL", fake.url)
    monkeypatch.setenv("LIVEKIT_API_KEY", "APItestkey")
    monkeypatch.setenv("LIVEKIT_API_SECRET", "test-secret-for-jwt-signing")

    import app.api.marketplace_api as api_mod
    import app.application.livekit_tokens as lk_mod

    for mod in (api_mod, lk_mod):
        monkeypatch.setattr(mod, "mint_room_token", fake.mint_room_token, raising=False)
        monkeypatch.setattr(mod, "mint_observe_token", fake.mint_observe_token, raising=False)
        monkeypatch.setattr(
            mod, "remove_room_participant", fake.remove_room_participant, raising=False
        )
        monkeypatch.setattr(mod, "update_participant", fake.update_participant, raising=False)
        monkeypatch.setattr(mod, "list_room_participants", fake.list_participants, raising=False)
    return fake
