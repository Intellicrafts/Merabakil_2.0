"""Listing, booking, inbox, and admin appointment checks."""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

_ROOT = Path(__file__).resolve().parents[4]
_MP = _ROOT / "backend" / "services" / "lawyer-marketplace"
_COMMON = _ROOT / "backend" / "libs" / "legalos_common"
sys.path[:0] = [str(_MP), str(_COMMON), str(_ROOT / "backend" / "scripts")]

from app.constants import ADVOCATE_USER_ID, CITIZEN_USER_ID, PRIYA_LAWYER_ID  # noqa: E402
from legalos_common.security.jwt import create_access_token  # noqa: E402


def _token(user_id: uuid.UUID, role: str) -> str:
    perms = ["research:read", "user:manage"] if role == "admin" else ["research:read"]
    return create_access_token(str(user_id), roles=[role], permissions=perms)


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


def _auth(role: str, user_id: uuid.UUID | None = None) -> dict[str, str]:
    uid = user_id or (ADVOCATE_USER_ID if role == "advocate" else CITIZEN_USER_ID)
    if role == "admin":
        uid = uuid.UUID("00000000-0000-4000-8000-000000000001")
    return {"Authorization": f"Bearer {_token(uid, role)}"}


def test_list_contains_only_seeded_verified_advocate(client: TestClient) -> None:
    rows = client.get("/api/v1/lawyers", headers=_auth("citizen")).json()
    assert client.get("/api/v1/lawyers", headers=_auth("citizen")).status_code == 200
    assert {row["full_name"] for row in rows} == {"Adv. Priya Sharma"}
    assert all(row["is_verified"] and row["user_id"] for row in rows)


def test_match_uses_same_verified_catalog(client: TestClient) -> None:
    rows = client.post(
        "/api/v1/lawyers/match",
        headers=_auth("citizen"),
        json={"practice_areas": ["Criminal"], "city": "Delhi", "limit": 3},
    ).json()
    assert len(rows) == 1
    assert rows[0]["id"] == str(PRIYA_LAWYER_ID)


def test_book_verified_and_both_inboxes(client: TestClient) -> None:
    booked = client.post(
        "/api/v1/appointments",
        headers=_auth("citizen"),
        json={
            "lawyer_id": str(PRIYA_LAWYER_ID),
            "date": date.today().isoformat(),
            "time_slot": "Immediate",
            "matter_summary": "Need urgent criminal defence advice in Delhi.",
            "source": "manual",
            "citizen_name": "Aarav Mehta",
        },
    )
    assert booked.status_code == 201, booked.text
    body = booked.json()
    assert body["citizen_user_id"] == str(CITIZEN_USER_ID)
    assert body["lawyer_user_id"] == str(ADVOCATE_USER_ID)
    assert body["citizen_name"] == "Aarav Mehta"

    citizen_inbox = client.get("/api/v1/appointments", headers=_auth("citizen")).json()
    lawyer_inbox = client.get("/api/v1/appointments", headers=_auth("advocate")).json()
    assert any(row["id"] == body["id"] for row in citizen_inbox)
    assert any(row["id"] == body["id"] for row in lawyer_inbox)


def test_book_unverified_returns_404(client: TestClient) -> None:
    listing = client.put(
        "/api/v1/lawyers/me",
        headers=_auth("advocate", uuid.UUID("00000000-0000-4000-8000-000000000099")),
        json={"full_name": "Hidden Counsel", "city": "Delhi", "bio": "Test listing"},
    )
    assert listing.status_code == 200
    lawyer_id = listing.json()["id"]
    admin = _auth("admin")
    client.patch(
        f"/api/v1/admin/lawyers/{lawyer_id}",
        headers=admin,
        json={"is_verified": False},
    )
    resp = client.post(
        "/api/v1/appointments",
        headers=_auth("citizen"),
        json={
            "lawyer_id": lawyer_id,
            "date": date.today().isoformat(),
            "time_slot": "Immediate",
            "matter_summary": "Should not be bookable after unverify.",
            "source": "manual",
        },
    )
    assert resp.status_code == 404
    listed = client.get("/api/v1/lawyers", headers=_auth("citizen")).json()
    assert lawyer_id not in {row["id"] for row in listed}


def test_admin_force_cancel(client: TestClient) -> None:
    booked = client.post(
        "/api/v1/appointments",
        headers=_auth("citizen"),
        json={
            "lawyer_id": str(PRIYA_LAWYER_ID),
            "date": date.today().isoformat(),
            "time_slot": "Start in 1 minute",
            "matter_summary": "Admin will force-cancel this booking shortly.",
            "source": "ai_match",
            "citizen_name": "Aarav Mehta",
        },
    )
    assert booked.status_code == 201, booked.text
    apt_id = booked.json()["id"]
    cancelled = client.post(
        f"/api/v1/admin/appointments/{apt_id}/force-cancel",
        headers=_auth("admin"),
        json={"reason": "Duplicate booking entered by mistake."},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


def _book(client: TestClient) -> str:
    booked = client.post(
        "/api/v1/appointments",
        headers=_auth("citizen"),
        json={
            "lawyer_id": str(PRIYA_LAWYER_ID),
            "date": date.today().isoformat(),
            "time_slot": "Immediate",
            "matter_summary": "Need urgent criminal defence advice in Delhi.",
            "source": "manual",
            "citizen_name": "Aarav Mehta",
        },
    )
    assert booked.status_code == 201, booked.text
    return booked.json()["id"]


_TINY_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)

_TINY_WAV = (
    b"RIFF"
    + (40).to_bytes(4, "little")
    + b"WAVEfmt "
    + (16).to_bytes(4, "little")
    + (1).to_bytes(2, "little")
    + (1).to_bytes(2, "little")
    + (8000).to_bytes(4, "little")
    + (16000).to_bytes(4, "little")
    + (2).to_bytes(2, "little")
    + (16).to_bytes(2, "little")
    + b"data"
    + (4).to_bytes(4, "little")
    + b"\x00\x00\x00\x00"
)


def test_typing_is_one_sided(client: TestClient) -> None:
    apt_id = _book(client)
    on = client.post(
        f"/api/v1/appointments/{apt_id}/typing",
        headers=_auth("citizen"),
        json={"on": True},
    )
    assert on.status_code == 200
    lawyer = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("advocate")).json()
    citizen = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("citizen")).json()
    assert lawyer["opponent_typing"] is True
    assert citizen["opponent_typing"] is False
    off = client.post(
        f"/api/v1/appointments/{apt_id}/typing",
        headers=_auth("citizen"),
        json={"on": False},
    )
    assert off.status_code == 200
    lawyer_after = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("advocate")).json()
    assert lawyer_after["opponent_typing"] is False


def test_message_publishes_to_hub(client: TestClient) -> None:
    from app.application.room_hub import subscribe

    apt_id = _book(client)
    queue = subscribe(apt_id)
    sent = client.post(
        f"/api/v1/appointments/{apt_id}/messages",
        headers=_auth("citizen"),
        json={"body": "Hello counsel, thank you for joining."},
    )
    assert sent.status_code == 201, sent.text
    event = queue.get_nowait()
    assert event["type"] == "message"
    assert event["payload"]["body"] == "Hello counsel, thank you for joining."
    assert event["payload"]["sender_user_id"] == str(CITIZEN_USER_ID)


def test_attachment_maps_and_downloads(client: TestClient) -> None:
    apt_id = _book(client)
    uploaded = client.post(
        f"/api/v1/appointments/{apt_id}/attachments",
        headers=_auth("citizen"),
        files={"file": ("scene.png", _TINY_PNG, "image/png")},
        data={"kind": "image", "caption": "Scene photo"},
    )
    assert uploaded.status_code == 201, uploaded.text
    body = uploaded.json()
    assert body["kind"] == "attachment"
    assert body["attachment"]["sender_user_id"] == str(CITIZEN_USER_ID)
    assert body["attachment"]["receiver_user_id"] == str(ADVOCATE_USER_ID)
    assert body["attachment"]["consultation_id"] == apt_id
    att_id = body["attachment"]["id"]
    downloaded = client.get(
        f"/api/v1/appointments/{apt_id}/attachments/{att_id}",
        headers=_auth("advocate"),
    )
    assert downloaded.status_code == 200
    assert downloaded.content == _TINY_PNG
    closed = client.post(
        f"/api/v1/admin/appointments/{apt_id}/force-complete",
        headers=_auth("admin"),
        json={"reason": "Session ended for transcript export test."},
    )
    assert closed.status_code == 200, closed.text
    transcript = client.get(f"/api/v1/appointments/{apt_id}/transcript", headers=_auth("citizen"))
    assert transcript.status_code == 200, transcript.text
    messages = transcript.json()["messages"]
    assert any(row.get("kind") == "attachment" and row.get("attachment", {}).get("filename") == "scene.png" for row in messages)


def test_voice_note_upload_download_and_after(client: TestClient) -> None:
    apt_id = _book(client)
    first = client.post(
        f"/api/v1/appointments/{apt_id}/messages",
        headers=_auth("citizen"),
        json={"body": "About to send a voice note."},
    )
    assert first.status_code == 201, first.text
    uploaded = client.post(
        f"/api/v1/appointments/{apt_id}/attachments",
        headers=_auth("citizen"),
        files={"file": ("note.wav", _TINY_WAV, "audio/wav")},
        data={"kind": "voice", "caption": "Voice note"},
    )
    assert uploaded.status_code == 201, uploaded.text
    body = uploaded.json()
    assert body["kind"] == "attachment"
    att = body["attachment"]
    assert att["kind"] == "voice"
    assert att["sender_user_id"] == str(CITIZEN_USER_ID)
    assert att["receiver_user_id"] == str(ADVOCATE_USER_ID)
    assert att["consultation_id"] == apt_id
    downloaded = client.get(
        f"/api/v1/appointments/{apt_id}/attachments/{att['id']}",
        headers=_auth("advocate"),
    )
    assert downloaded.status_code == 200
    assert (downloaded.headers.get("content-type") or "").startswith("audio/")
    assert downloaded.content == _TINY_WAV
    assert "inline" in (downloaded.headers.get("content-disposition") or "").lower()
    newer = client.get(
        f"/api/v1/appointments/{apt_id}/messages?after={first.json()['id']}",
        headers=_auth("advocate"),
    )
    assert newer.status_code == 200, newer.text
    rows = newer.json()
    assert any(row.get("attachment", {}).get("kind") == "voice" and row.get("id") == body["id"] for row in rows)
    bad = client.post(
        f"/api/v1/appointments/{apt_id}/attachments",
        headers=_auth("citizen"),
        files={"file": ("payload.exe", b"MZ", "application/x-msdownload")},
        data={"kind": "voice"},
    )
    assert bad.status_code == 400


def test_messages_after_returns_only_newer(client: TestClient) -> None:
    apt_id = _book(client)
    first = client.post(
        f"/api/v1/appointments/{apt_id}/messages",
        headers=_auth("citizen"),
        json={"body": "First note for counsel."},
    ).json()
    second = client.post(
        f"/api/v1/appointments/{apt_id}/messages",
        headers=_auth("advocate"),
        json={"body": "Second note from counsel."},
    ).json()
    newer = client.get(
        f"/api/v1/appointments/{apt_id}/messages?after={first['id']}",
        headers=_auth("advocate"),
    ).json()
    assert [row["id"] for row in newer] == [second["id"]]
    assert newer[0]["body"] == "Second note from counsel."


def test_two_subscribers_receive_published_message(client: TestClient) -> None:
    from app.application.room_hub import subscribe

    apt_id = _book(client)
    sender_q = subscribe(apt_id)
    receiver_q = subscribe(apt_id)
    sent = client.post(
        f"/api/v1/appointments/{apt_id}/messages",
        headers=_auth("citizen"),
        json={"body": "Live to both sides."},
    )
    assert sent.status_code == 201
    first = sender_q.get_nowait()
    second = receiver_q.get_nowait()
    assert first["type"] == "message"
    assert second["type"] == "message"
    assert first["payload"]["id"] == second["payload"]["id"] == sent.json()["id"]


def test_rejects_bad_attachment_type(client: TestClient, monkeypatch) -> None:
    from app.infrastructure import file_store

    apt_id = _book(client)
    bad = client.post(
        f"/api/v1/appointments/{apt_id}/attachments",
        headers=_auth("citizen"),
        files={"file": ("payload.exe", b"MZ", "application/x-msdownload")},
    )
    assert bad.status_code == 400
    monkeypatch.setattr(file_store, "MAX_BYTES", 8)
    huge = client.post(
        f"/api/v1/appointments/{apt_id}/attachments",
        headers=_auth("citizen"),
        files={"file": ("note.txt", b"this is too large for the test cap", "text/plain")},
    )
    assert huge.status_code == 400


def test_admin_list_contains_booking(client: TestClient) -> None:
    apt_id = _book(client)
    listed = client.get("/api/v1/admin/appointments", headers=_auth("admin")).json()
    assert any(row["id"] == apt_id for row in listed["items"])


def test_emergency_lifecycle(client: TestClient) -> None:
    apt_id = _book(client)
    opened = client.post(
        f"/api/v1/appointments/{apt_id}/emergency",
        headers=_auth("citizen"),
        json={"reason": "Counsel has not joined and matter is urgent."},
    )
    assert opened.status_code == 200, opened.text
    body = opened.json()
    assert body["emergency_status"] == "open"
    assert body["priority"] == "emergency"
    ack = client.post(f"/api/v1/admin/appointments/{apt_id}/emergency/ack", headers=_auth("admin"))
    assert ack.status_code == 200
    assert ack.json()["emergency_status"] == "ack"
    resolved = client.post(f"/api/v1/admin/appointments/{apt_id}/emergency/resolve", headers=_auth("admin"))
    assert resolved.status_code == 200
    assert resolved.json()["emergency_status"] == "resolved"
    detail = client.get(f"/api/v1/admin/appointments/{apt_id}", headers=_auth("admin")).json()
    types = [e["type"] for e in detail["events"]]
    assert "emergency_opened" in types
    assert "emergency_acked" in types
    assert "emergency_resolved" in types


def test_admin_extend_reassign_and_system_message(client: TestClient) -> None:
    apt_id = _book(client)
    before = client.get(f"/api/v1/admin/appointments/{apt_id}", headers=_auth("admin")).json()["appointment"]
    end_before = before["scheduled_end_at"]
    extended = client.post(
        f"/api/v1/admin/appointments/{apt_id}/extend",
        headers=_auth("admin"),
        json={"minutes": 10},
    )
    assert extended.status_code == 200, extended.text
    end_after = extended.json()["scheduled_end_at"]
    assert end_after != end_before

    listing = client.put(
        "/api/v1/lawyers/me",
        headers=_auth("advocate", uuid.UUID("00000000-0000-4000-8000-000000000099")),
        json={"full_name": "Adv. Backup Counsel", "city": "Delhi", "bio": "Backup listing"},
    )
    assert listing.status_code == 200
    backup_id = listing.json()["id"]
    client.patch(
        f"/api/v1/admin/lawyers/{backup_id}",
        headers=_auth("admin"),
        json={"is_verified": True},
    )
    reassigned = client.post(
        f"/api/v1/admin/appointments/{apt_id}/reassign",
        headers=_auth("admin"),
        json={"lawyer_id": backup_id},
    )
    assert reassigned.status_code == 200, reassigned.text
    assert reassigned.json()["lawyer_id"] == backup_id

    marker = client.post(
        f"/api/v1/admin/appointments/{apt_id}/system-message",
        headers=_auth("admin"),
        json={"body": "Ops: please continue while we extend your window."},
    )
    assert marker.status_code == 201, marker.text
    msg_id = marker.json()["id"]
    after = client.get(
        f"/api/v1/appointments/{apt_id}/messages?after={uuid.uuid4()}",
        headers=_auth("citizen"),
    )
    # empty after random uuid - get all instead
    all_msgs = client.get(f"/api/v1/appointments/{apt_id}/messages", headers=_auth("citizen")).json()
    assert any(m["id"] == msg_id and m["sender_role"] == "admin" for m in all_msgs)
    transcript = client.get(f"/api/v1/admin/appointments/{apt_id}", headers=_auth("admin")).json()
    assert any(m["body"].startswith("Ops:") for m in transcript["messages"])


def test_force_cancel_requires_reason(client: TestClient) -> None:
    apt_id = _book(client)
    bad = client.post(f"/api/v1/admin/appointments/{apt_id}/force-cancel", headers=_auth("admin"), json={})
    assert bad.status_code == 422
    ok = client.post(
        f"/api/v1/admin/appointments/{apt_id}/force-cancel",
        headers=_auth("admin"),
        json={"reason": "Citizen requested immediate cancellation."},
    )
    assert ok.status_code == 200
    events = client.get(f"/api/v1/admin/appointments/{apt_id}", headers=_auth("admin")).json()["events"]
    force = next(e for e in events if e["type"] == "force_cancelled")
    assert force["payload"].get("reason") == "Citizen requested immediate cancellation."


def test_leave_clears_presence_for_opponent(client: TestClient) -> None:
    apt_id = _book(client)
    client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("citizen"))
    client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("advocate"))
    client.post(f"/api/v1/appointments/{apt_id}/leave", headers=_auth("citizen"))
    advocate_view = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("advocate")).json()
    assert advocate_view["opponent_present"] is False


def test_dismiss_emits_summon_cleared(client: TestClient) -> None:
    from app.application.room_hub import subscribe_user

    apt_id = _book(client)
    queue = subscribe_user(str(ADVOCATE_USER_ID))
    client.post(f"/api/v1/appointments/{apt_id}/summon", headers=_auth("citizen"))
    queue.get_nowait()
    client.post(f"/api/v1/appointments/{apt_id}/summon/dismiss", headers=_auth("advocate"))
    cleared = queue.get_nowait()
    assert cleared["type"] == "summon_cleared"
    assert cleared["appointment_id"] == apt_id


def test_summon_rejected_when_opponent_present(client: TestClient) -> None:
    apt_id = _book(client)
    client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("advocate"))
    client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("advocate"))
    bad = client.post(f"/api/v1/appointments/{apt_id}/summon", headers=_auth("citizen"))
    assert bad.status_code == 409


def test_prior_join_after_room_token(client: TestClient) -> None:
    apt_id = _book(client)
    before = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("citizen")).json()
    assert before["prior_join"] is False
    client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("citizen"))
    after = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("citizen")).json()
    assert after["prior_join"] is True


def test_admin_list_with_both_parties_in_room(client: TestClient) -> None:
    apt_id = _book(client)
    client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("citizen"))
    client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("advocate"))
    listed = client.get("/api/v1/admin/appointments", headers=_auth("admin"))
    assert listed.status_code == 200, listed.text
    assert any(row["id"] == apt_id for row in listed.json()["items"])


def test_summon_clears_when_target_joins_room(client: TestClient) -> None:
    apt_id = _book(client)
    client.post(f"/api/v1/appointments/{apt_id}/summon", headers=_auth("citizen"))
    advocate_before = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("advocate")).json()
    assert advocate_before["pending_summon"] is True
    client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("advocate"))
    advocate_after = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("advocate")).json()
    assert advocate_after["pending_summon"] is False


def test_dismiss_summon_clears_pending(client: TestClient) -> None:
    apt_id = _book(client)
    client.post(f"/api/v1/appointments/{apt_id}/summon", headers=_auth("citizen"))
    advocate = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("advocate")).json()
    assert advocate["pending_summon"] is True
    dismissed = client.post(f"/api/v1/appointments/{apt_id}/summon/dismiss", headers=_auth("advocate"))
    assert dismissed.status_code == 200
    assert dismissed.json()["pending_summon"] is False


def test_summon_publishes_to_user_inbox(client: TestClient) -> None:
    from app.application.room_hub import subscribe_user

    apt_id = _book(client)
    queue = subscribe_user(str(ADVOCATE_USER_ID))
    summoned = client.post(f"/api/v1/appointments/{apt_id}/summon", headers=_auth("citizen"))
    assert summoned.status_code == 200, summoned.text
    event = queue.get_nowait()
    assert event["type"] == "summon"
    assert event["appointment_id"] == apt_id
    assert event["payload"]["target_user_id"] == str(ADVOCATE_USER_ID)


def test_summon_publishes_to_hub(client: TestClient) -> None:
    from app.application.room_hub import subscribe

    apt_id = _book(client)
    queue = subscribe(apt_id)
    summoned = client.post(f"/api/v1/appointments/{apt_id}/summon", headers=_auth("citizen"))
    assert summoned.status_code == 200, summoned.text
    event = queue.get_nowait()
    assert event["type"] == "summon"
    assert event["payload"]["target_user_id"] == str(ADVOCATE_USER_ID)
    assert event["payload"]["from_name"]
    advocate = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("advocate")).json()
    assert advocate["pending_summon"] is True


def test_emergency_publishes_to_hub_and_admin_list(client: TestClient) -> None:
    from app.application.room_hub import subscribe, subscribe_admin

    apt_id = _book(client)
    room_q = subscribe(apt_id)
    admin_q = subscribe_admin()
    opened = client.post(
        f"/api/v1/appointments/{apt_id}/emergency",
        headers=_auth("citizen"),
        json={"reason": "Counsel disconnected mid-call."},
    )
    assert opened.status_code == 200, opened.text
    room_event = room_q.get_nowait()
    assert room_event["type"] == "emergency"
    assert room_event["payload"]["emergency_status"] == "open"
    admin_event = admin_q.get_nowait()
    assert admin_event["type"] == "emergency"
    assert admin_event["appointment_id"] == apt_id
    listed = client.get("/api/v1/admin/appointments?emergency=open", headers=_auth("admin")).json()
    assert any(row["id"] == apt_id and row["emergency_status"] == "open" for row in listed["items"])


def test_admin_ack_updates_join_state(client: TestClient) -> None:
    apt_id = _book(client)
    client.post(
        f"/api/v1/appointments/{apt_id}/emergency",
        headers=_auth("citizen"),
        json={"reason": "Need ops assistance."},
    )
    ack = client.post(f"/api/v1/admin/appointments/{apt_id}/emergency/ack", headers=_auth("admin"))
    assert ack.status_code == 200
    join = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("citizen")).json()
    assert join["emergency_status"] == "ack"


def test_force_summon_sets_pending_for_target(client: TestClient) -> None:
    from app.application.room_hub import subscribe

    apt_id = _book(client)
    queue = subscribe(apt_id)
    forced = client.post(f"/api/v1/admin/appointments/{apt_id}/force-summon", headers=_auth("admin"))
    assert forced.status_code == 200, forced.text
    event = queue.get_nowait()
    assert event["type"] == "summon"
    assert event["payload"]["target_user_id"] == str(ADVOCATE_USER_ID)
    advocate = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("advocate")).json()
    assert advocate["pending_summon"] is True


def test_admin_live_matrix_after_room_token(client: TestClient) -> None:
    apt_id = _book(client)
    joined = client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("citizen"))
    assert joined.status_code == 200, joined.text
    listed = client.get("/api/v1/admin/appointments", headers=_auth("admin"))
    assert listed.status_code == 200, listed.text
    body = listed.json()
    assert body["live_total"] >= 1
    assert any(row["id"] == apt_id for row in body["live_matrix"])
    live_row = next(row for row in body["live_matrix"] if row["id"] == apt_id)
    assert live_row["status"] == "live"
    assert live_row["citizen_present"] is True

    live_only = client.get("/api/v1/admin/appointments?live=true", headers=_auth("admin"))
    assert live_only.status_code == 200
    assert all(row["status"] == "live" or row["join_state"] == "joinable" for row in live_only.json()["items"])


def test_inbox_events_route_not_uuid_collision(client: TestClient) -> None:
    """Static /inbox/events must register before /{appointment_id}/events (see route order)."""
    collision = client.get("/api/v1/appointments/inbox", headers=_auth("advocate"))
    assert collision.status_code == 422
    assert collision.json()["details"][0]["loc"] == ["path", "appointment_id"]


def test_room_token_unconfigured(client: TestClient, monkeypatch) -> None:
    monkeypatch.delenv("LIVEKIT_URL", raising=False)
    monkeypatch.delenv("LIVEKIT_API_KEY", raising=False)
    monkeypatch.delenv("LIVEKIT_API_SECRET", raising=False)
    apt_id = _book(client)
    res = client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("citizen"))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["configured"] is False
    assert body["mode"] == "polling"
    assert body["token"] is None
    assert body["url"] is None
    assert body["room"].startswith("apt-")


def test_room_token_livekit_configured(client: TestClient, monkeypatch) -> None:
    monkeypatch.setenv("LIVEKIT_URL", "wss://test.livekit.cloud")
    monkeypatch.setenv("LIVEKIT_API_KEY", "APItestkey")
    monkeypatch.setenv("LIVEKIT_API_SECRET", "test-secret-for-jwt-signing")
    apt_id = _book(client)
    res = client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("citizen"))
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["configured"] is True
    assert body["mode"] == "livekit"
    assert body["token"]
    assert body["url"] == "wss://test.livekit.cloud"
    assert body["room"].startswith("apt-")


def test_call_ring_publishes_to_room_and_inbox(client: TestClient) -> None:
    from app.application.room_hub import subscribe_user

    apt_id = _book(client)
    queue = subscribe_user(str(ADVOCATE_USER_ID))
    ring = client.post(
        f"/api/v1/appointments/{apt_id}/call/ring",
        headers=_auth("citizen"),
        json={"mode": "video"},
    )
    assert ring.status_code == 200, ring.text
    body = ring.json()
    assert body["mode"] == "video"
    assert body["status"] == "ringing"
    event = queue.get_nowait()
    assert event["type"] == "incoming_call"
    assert event["payload"]["call_id"] == body["call_id"]


def test_call_accept_clears_pending(client: TestClient) -> None:
    from app.application.room_hub import subscribe

    apt_id = _book(client)
    queue = subscribe(apt_id)
    ring = client.post(
        f"/api/v1/appointments/{apt_id}/call/ring",
        headers=_auth("citizen"),
        json={"mode": "audio"},
    ).json()
    queue.get_nowait()
    accepted = client.post(
        f"/api/v1/appointments/{apt_id}/call/respond",
        headers=_auth("advocate"),
        json={"call_id": ring["call_id"], "action": "accept"},
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["status"] == "accepted"
    event = queue.get_nowait()
    assert event["type"] == "call_accepted"


def test_call_decline_notifies_caller(client: TestClient) -> None:
    from app.application.room_hub import subscribe_user

    apt_id = _book(client)
    caller_queue = subscribe_user(str(CITIZEN_USER_ID))
    ring = client.post(
        f"/api/v1/appointments/{apt_id}/call/ring",
        headers=_auth("citizen"),
        json={"mode": "video"},
    ).json()
    caller_queue.get_nowait()
    declined = client.post(
        f"/api/v1/appointments/{apt_id}/call/respond",
        headers=_auth("advocate"),
        json={"call_id": ring["call_id"], "action": "decline"},
    )
    assert declined.status_code == 200, declined.text
    event = caller_queue.get_nowait()
    assert event["type"] == "call_declined"


def test_call_cancel_by_caller(client: TestClient) -> None:
    from app.application.room_hub import subscribe_user

    apt_id = _book(client)
    callee_queue = subscribe_user(str(ADVOCATE_USER_ID))
    ring = client.post(
        f"/api/v1/appointments/{apt_id}/call/ring",
        headers=_auth("citizen"),
        json={"mode": "audio"},
    ).json()
    callee_queue.get_nowait()
    cancelled = client.post(
        f"/api/v1/appointments/{apt_id}/call/cancel",
        headers=_auth("citizen"),
        json={"call_id": ring["call_id"]},
    )
    assert cancelled.status_code == 200, cancelled.text
    event = callee_queue.get_nowait()
    assert event["type"] == "call_cancelled"


def test_call_ring_rejected_when_already_ringing(client: TestClient) -> None:
    apt_id = _book(client)
    first = client.post(
        f"/api/v1/appointments/{apt_id}/call/ring",
        headers=_auth("citizen"),
        json={"mode": "video"},
    )
    assert first.status_code == 200
    second = client.post(
        f"/api/v1/appointments/{apt_id}/call/ring",
        headers=_auth("citizen"),
        json={"mode": "audio"},
    )
    assert second.status_code == 409


def test_join_state_includes_pending_incoming_call(client: TestClient) -> None:
    apt_id = _book(client)
    ring = client.post(
        f"/api/v1/appointments/{apt_id}/call/ring",
        headers=_auth("citizen"),
        json={"mode": "video"},
    ).json()
    join = client.get(f"/api/v1/appointments/{apt_id}/join-state", headers=_auth("advocate")).json()
    assert join["pending_incoming_call"] is not None
    assert join["pending_incoming_call"]["call_id"] == ring["call_id"]
    assert join["pending_incoming_call"]["mode"] == "video"


def test_kick_participant_allows_rejoin(client: TestClient) -> None:
    from app.application.room_hub import subscribe

    apt_id = _book(client)
    client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("citizen"))
    room_q = subscribe(apt_id)
    kicked = client.post(
        f"/api/v1/admin/appointments/{apt_id}/moderate/kick",
        headers=_auth("admin"),
        json={"target": "citizen", "reason": "Heated exchange — cooling off."},
    )
    assert kicked.status_code == 200, kicked.text
    body = kicked.json()
    assert body["citizen_moderation"]["status"] == "kicked"
    mod_event = room_q.get_nowait()
    assert mod_event["type"] == "moderation"
    assert mod_event["payload"]["action"] == "kick"
    detail = client.get(f"/api/v1/admin/appointments/{apt_id}", headers=_auth("admin")).json()
    assert "participant_kicked" in [e["type"] for e in detail["events"]]
    rejoin = client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("citizen"))
    assert rejoin.status_code == 200, rejoin.text


def test_suspend_blocks_room_token_until_unsuspended(client: TestClient) -> None:
    apt_id = _book(client)
    client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("citizen"))
    suspended = client.post(
        f"/api/v1/admin/appointments/{apt_id}/moderate/suspend",
        headers=_auth("admin"),
        json={"target": "citizen", "minutes": 15, "reason": "Repeated disruption in conference."},
    )
    assert suspended.status_code == 200, suspended.text
    assert suspended.json()["citizen_moderation"]["status"] == "suspended"
    blocked = client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("citizen"))
    assert blocked.status_code == 403
    assert "suspended" in (blocked.json().get("detail") or "").lower()
    lifted = client.post(
        f"/api/v1/admin/appointments/{apt_id}/moderate/unsuspend",
        headers=_auth("admin"),
        json={"target": "citizen"},
    )
    assert lifted.status_code == 200, lifted.text
    assert lifted.json()["citizen_moderation"]["status"] == "none"
    rejoin = client.post(f"/api/v1/appointments/{apt_id}/room-token", headers=_auth("citizen"))
    assert rejoin.status_code == 200, rejoin.text


def test_non_admin_cannot_moderate(client: TestClient) -> None:
    apt_id = _book(client)
    denied = client.post(
        f"/api/v1/admin/appointments/{apt_id}/moderate/kick",
        headers=_auth("citizen"),
        json={"target": "lawyer", "reason": "Should fail"},
    )
    assert denied.status_code == 403
