"""Advocate enrolment verification: name matching, outcomes and the Satyapan round trip."""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

import pytest

from app.api import marketplace_api as api
from app.application.name_match import names_match


@pytest.mark.parametrize(
    ("profile", "record", "expected"),
    [
        ("Adv. Mandeep Kaur", "MANDEEP KAUR", True),
        ("Kaur Harpreet", "HARPREET KAUR", True),
        ("R. K. Sharma", "RAJESH KUMAR SHARMA", True),
        ("Rajesh Kumar Sharma", "R K SHARMA", True),
        ("Mohan Lal", "MOHANLAL", True),
        ("Satish Chandra Mittal", "SATISH CHANDER MITTAL", True),
        ("Mohd Arif", "MOHAMMAD ARIF", True),
        ("Amit Kumar", "AMIT KUMAR S/O RAM KUMAR", True),
        ("Amit Kumar", "AMIT KUMAR SINGH", True),
        # Someone else's number (a real pattern from BCPH's 2026 invalid-voter list)
        ("Manoj Bishnoi", "RACHHPAL CHAND", False),
        ("Priya Sharma", "PRIYA VERMA", False),
        ("Gurpreet Singh", "GURMEET SINGH", False),
        ("A K", "AMIT KUMAR", False),  # initials alone prove nothing
        ("राजेश शर्मा", "RAJESH SHARMA", False),  # can't compare scripts → a person checks
        ("", "AMIT KUMAR", False),
    ],
)
def test_names_match(profile: str, record: str, expected: bool) -> None:
    assert names_match(profile, record) is expected


def test_outcomes() -> None:
    assert api.verification_outcome("success", "Mandeep Kaur", "MANDEEP KAUR") == ("verified", None)
    assert api.verification_outcome("success", "Manoj Bishnoi", "RACHHPAL CHAND") == ("needs_review", "name_mismatch")
    assert api.verification_outcome("not_found", "Ashu", None) == ("needs_review", "not_in_roll")
    assert api.verification_outcome("failed", "Ashu", None) == ("failed", None)
    assert api.verification_outcome("error", "Ashu", None) == ("failed", None)


@pytest.mark.parametrize(
    ("number", "state"),
    [("P/1150/1993", "Punjab & Haryana"), ("PH/6475/2023", "Punjab & Haryana"), ("UP12345/2010", "Uttar Pradesh"),
     ("AP/1/2000", "Andhra Pradesh"), ("D/1/2000", "Delhi"), ("R/176A/1978", "Rajasthan"), ("X/1/2000", None)],
)
def test_bar_council_detection(number: str, state: str | None) -> None:
    assert api._detect_bar_council_state(number) == state


def _lawyer(name: str, **extra):
    return SimpleNamespace(
        id=uuid.uuid4(), full_name=name, bar_council_id=None, is_verified=False,
        verification_data=None, verified_at=None, **extra,
    )


def _satyapan(monkeypatch, inner: dict) -> list[dict]:
    sent: list[dict] = []

    class FakeClient:
        def __init__(self, *a, **kw): ...
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False

        async def post(self, url, json):
            sent.append(json)
            return SimpleNamespace(json=lambda: {"status": "success", "message": "", "data": inner})

    import httpx
    monkeypatch.setattr(httpx, "AsyncClient", FakeClient)
    return sent


def test_matching_record_verifies(monkeypatch) -> None:
    sent = _satyapan(monkeypatch, {"status": "success", "data": {"name": "MANDEEP KAUR", "state": "Punjab"}})
    lawyer = _lawyer("Mandeep Kaur")
    resp = asyncio.run(api._verify_enrollment(lawyer, "P/1150/1993", None))
    assert sent == [{"enrollment_number": "P/1150/1993", "state": "Punjab & Haryana"}]
    assert resp.status == "success" and lawyer.is_verified and lawyer.verified_at
    assert lawyer.verification_data["outcome"] == "verified"


def test_someone_elses_number_goes_to_review(monkeypatch) -> None:
    _satyapan(monkeypatch, {"status": "success", "data": {"name": "RACHHPAL CHAND"}})
    lawyer = _lawyer("Manoj Bishnoi")
    resp = asyncio.run(api._verify_enrollment(lawyer, "P/1669/2008", None))
    assert resp.status == "needs_review" and not lawyer.is_verified
    assert lawyer.verification_data["review_reason"] == "name_mismatch"
    assert lawyer.verification_data["record_name"] == "RACHHPAL CHAND"


def test_recent_enrolment_goes_to_review(monkeypatch) -> None:
    _satyapan(monkeypatch, {"status": "not_found", "message": "Not found", "data": {}})
    lawyer = _lawyer("Ashu")
    resp = asyncio.run(api._verify_enrollment(lawyer, "PH/1/2026", None))
    assert resp.status == "needs_review" and not lawyer.is_verified
    assert "review" in resp.message


def test_suspended_is_not_verified(monkeypatch) -> None:
    _satyapan(monkeypatch, {"status": "failed", "message": "records show this enrolment as suspended.", "data": {}})
    lawyer = _lawyer("Amit Kumar")
    resp = asyncio.run(api._verify_enrollment(lawyer, "PH/2327/2019", None))
    assert resp.status == "failed" and not lawyer.is_verified and "suspended" in resp.message


def test_admin_approval_survives_a_recheck(monkeypatch) -> None:
    _satyapan(monkeypatch, {"status": "not_found", "data": {}})
    approved = {"outcome": "verified", "review": {"decision": "approve", "by": "admin-1"}}
    lawyer = _lawyer("Ashu", )
    lawyer.bar_council_id, lawyer.is_verified, lawyer.verification_data = "PH/1/2026", True, approved
    asyncio.run(api._verify_enrollment(lawyer, "PH/1/2026", None))
    assert lawyer.is_verified and lawyer.verification_data["review"]["decision"] == "approve"


# ── Manual decisions and profile edits ───────────────────────────────────────

from fastapi import HTTPException  # noqa: E402


def test_admin_decisions_are_recorded_and_need_an_enrolment_number() -> None:
    lawyer = _lawyer("Ashu")
    with pytest.raises(HTTPException) as err:
        api._record_admin_decision(lawyer, "approve", "admin-1", None)
    assert err.value.status_code == 400 and not lawyer.is_verified

    lawyer.bar_council_id = "PH/1/2026"
    api._record_admin_decision(lawyer, "approve", "admin-1", "Checked certificate")
    review = lawyer.verification_data["review"]
    assert lawyer.is_verified and lawyer.verified_at
    assert (review["by"], review["note"], review["bar_council_id"]) == ("admin-1", "Checked certificate", "PH/1/2026")

    api._record_admin_decision(lawyer, "revoke", "admin-2", None)  # the appointments-page toggle
    assert not lawyer.is_verified and lawyer.verification_data["outcome"] == "revoked"


def _verified(name: str, bar_id: str, record_name: str):
    lawyer = _lawyer(name)
    lawyer.bar_council_id, lawyer.is_verified, lawyer.verified_at = bar_id, True, "2026-10-01"
    lawyer.verification_data = {"outcome": "verified", "record_name": record_name, "data": {"name": record_name}}
    return lawyer


def test_renaming_to_someone_else_after_verification_needs_review() -> None:
    lawyer = _verified("Mandeep Kaur", "P/1150/1993", "MANDEEP KAUR")
    lawyer.full_name = "Senior Advocate Harish Salve"
    api._recheck_after_profile_edit(lawyer, old_name="Mandeep Kaur", old_bar_id="P/1150/1993")
    assert not lawyer.is_verified and lawyer.verification_data["review_reason"] == "name_changed"


def test_harmless_edits_keep_verification() -> None:
    lawyer = _verified("Mandeep Kaur", "P/1150/1993", "MANDEEP KAUR")
    lawyer.full_name = "Adv. Mandeep Kaur"  # still the record's name
    api._recheck_after_profile_edit(lawyer, old_name="Mandeep Kaur", old_bar_id="P/1150/1993")
    assert lawyer.is_verified


def test_new_enrolment_number_must_be_verified_again() -> None:
    lawyer = _verified("Mandeep Kaur", "P/9999/2001", "MANDEEP KAUR")
    api._recheck_after_profile_edit(lawyer, old_name="Mandeep Kaur", old_bar_id="P/1150/1993")
    assert not lawyer.is_verified and lawyer.verification_data["outcome"] is None


# ── Admin completes an advocate's listing ────────────────────────────────────

from tests.helpers import auth  # noqa: E402

ADV = uuid.UUID("00000000-0000-4000-8000-0000000000a1")
COMPLETE = {
    "full_name": "Naveen Sheokand", "bar_council_id": "P/1417/2012", "city": "Chandigarh",
    "practice_areas": ["Criminal"], "jurisdictions": ["Punjab and Haryana High Court"],
    "years_experience": 12, "hourly_rate": 1500,
    "bio": "Practising in criminal and civil matters before the Punjab and Haryana High Court.",
}


def test_admin_saves_a_listing_without_touching_verification(client) -> None:
    resp = client.put(f"/api/v1/admin/lawyers/by-user/{ADV}/listing", headers=auth("admin"), json=COMPLETE)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["full_name"] == "Naveen Sheokand" and body["hourly_rate"] == 1500
    assert body["is_verified"] is False  # an admin edit never verifies
    assert body["missing_for_listing"] == ["verification"] and body["missing_for_matching"] == []
    assert body["listed"] is False


def test_only_admins_can_edit_someone_elses_listing(client) -> None:
    for role in ("advocate", "citizen"):
        resp = client.put(f"/api/v1/admin/lawyers/by-user/{ADV}/listing", headers=auth(role), json=COMPLETE)
        assert resp.status_code == 403, role


def test_listing_status_explains_what_is_missing(client) -> None:
    no_fee = {k: v for k, v in COMPLETE.items() if k != "hourly_rate"} | {"bio": "Short"}
    created = client.put(f"/api/v1/admin/lawyers/by-user/{ADV}/listing", headers=auth("admin"), json=no_fee).json()
    assert created["missing_for_listing"] == ["verification", "consultation_fee"]
    assert created["missing_for_matching"] == ["bio", "consultation_fee"]

    client.patch(f"/api/v1/admin/lawyers/{created['id']}", headers=auth("admin"), json={"is_verified": True})
    done = client.put(f"/api/v1/admin/lawyers/by-user/{ADV}/listing", headers=auth("admin"), json=COMPLETE).json()
    assert done["is_verified"] is True and done["listed"] is True and done["missing_for_listing"] == []
    listing = client.get("/api/v1/lawyers", headers=auth("citizen")).json()
    assert "Naveen Sheokand" in {row["full_name"] for row in listing}  # now in the marketplace
