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
