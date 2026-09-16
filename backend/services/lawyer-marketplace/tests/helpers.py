"""Shared helpers for the lawyer-marketplace suite."""

from __future__ import annotations

import uuid
from datetime import date

from fastapi.testclient import TestClient

from app.constants import ADMIN_USER_ID, ADVOCATE_USER_ID, CITIZEN_USER_ID, PRIYA_LAWYER_ID
from legalos_common.security.jwt import create_access_token


def token(user_id: uuid.UUID, role: str) -> str:
    perms = ["research:read", "user:manage"] if role == "admin" else ["research:read"]
    return create_access_token(str(user_id), roles=[role], permissions=perms)


def auth(role: str, user_id: uuid.UUID | None = None) -> dict[str, str]:
    if role == "admin":
        uid = user_id or ADMIN_USER_ID
    else:
        uid = user_id or (ADVOCATE_USER_ID if role == "advocate" else CITIZEN_USER_ID)
    return {"Authorization": f"Bearer {token(uid, role)}"}


def book(client: TestClient, *, time_slot: str = "Immediate", **overrides) -> str:
    """Book an appointment as the seeded citizen against the seeded verified advocate."""
    payload = {
        "lawyer_id": str(PRIYA_LAWYER_ID),
        "date": date.today().isoformat(),
        "time_slot": time_slot,
        "matter_summary": "Need urgent criminal defence advice in Delhi.",
        "source": "manual",
        "citizen_name": "Aarav Mehta",
    }
    payload.update(overrides)
    booked = client.post("/api/v1/appointments", headers=auth("citizen"), json=payload)
    assert booked.status_code == 201, booked.text
    return booked.json()["id"]
