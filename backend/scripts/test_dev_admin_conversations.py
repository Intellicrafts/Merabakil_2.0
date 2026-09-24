#!/usr/bin/env python3
"""Smoke tests for native dev admin Saarthi conversation endpoints."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "backend" / "scripts"))
sys.path[:0] = [
    str(_ROOT / "backend" / "libs" / "legalos_common"),
    str(_ROOT / "backend" / "services" / "auth"),
]

from dev_bootstrap import bootstrap_dev_env  # noqa: E402

bootstrap_dev_env(_ROOT)

from app.main import app  # noqa: E402
from app.api.admin_conversations import router as admin_conversations_router  # noqa: E402
from app.api.conversations import router as conversations_router  # noqa: E402
from dev_admin_conversations import router as dev_admin_conversations_router  # noqa: E402
from dev_conversations import router as dev_conversations_router  # noqa: E402
from legalos_common.security import create_access_token  # noqa: E402

_POSTGRES_ROUTERS = (conversations_router, admin_conversations_router)
app.router.routes = [
    route
    for route in app.router.routes
    if getattr(route, "original_router", None) not in _POSTGRES_ROUTERS
]
app.include_router(dev_conversations_router)
app.include_router(dev_admin_conversations_router)

ADMIN_ID = "00000000-0000-4000-8000-000000000001"


def _admin_headers() -> dict[str, str]:
    token = create_access_token(ADMIN_ID, roles=["admin"], permissions=["user:manage"])
    return {"Authorization": f"Bearer {token}"}


def main() -> None:
    client = TestClient(app)
    headers = _admin_headers()

    stats = client.get("/api/v1/admin/conversations/stats", headers=headers)
    assert stats.status_code == 200, stats.text
    stats_body = stats.json()
    assert "totalConversations" in stats_body

    users = client.get("/api/v1/admin/conversations/users?page=1&size=20", headers=headers)
    assert users.status_code == 200, users.text
    users_body = users.json()
    assert users_body["total"] >= 0

    all_convs = client.get("/api/v1/admin/conversations?page=1&size=20", headers=headers)
    assert all_convs.status_code == 200, all_convs.text
    items = all_convs.json()["items"]
    if not items:
        print("WARN: no conversations in dev store — seed data may be empty")
        print("PASS: admin routes registered and auth OK")
        return

    conv_id = items[0]["id"]
    detail = client.get(f"/api/v1/admin/conversations/{conv_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    assert detail.json()["id"] == conv_id

    user_id = items[0]["userId"]
    user_convs = client.get(f"/api/v1/admin/conversations/users/{user_id}", headers=headers)
    assert user_convs.status_code == 200, user_convs.text
    assert isinstance(user_convs.json(), list)

    original_title = detail.json()["title"]
    patch = client.put(
        f"/api/v1/admin/conversations/{conv_id}",
        headers=headers,
        json={"title": "Admin test title"},
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["title"] == "Admin test title"

    restore = client.put(
        f"/api/v1/admin/conversations/{conv_id}",
        headers=headers,
        json={"title": original_title},
    )
    assert restore.status_code == 200, restore.text

    print(json.dumps({"stats": stats_body, "users_total": users_body["total"], "conversations": len(items)}, indent=2))
    print("PASS: dev admin conversation ops")


if __name__ == "__main__":
    main()
