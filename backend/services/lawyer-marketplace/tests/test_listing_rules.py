"""Mandatory listing details: one rule for advocate and admin saves, kept on the server."""

from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

from app.api import marketplace_api as api
from app.application.listing_rules import current_year, experience_years, missing_required
from tests.helpers import auth

NEW = uuid.UUID("00000000-0000-4000-8000-0000000000b1")
STEP1 = {"full_name": "Ashu Kumar", "bar_council_id": "PH/6475/2023"}
STEP2 = {
    "pincode": "135001", "city": "Yamunanagar", "location_state": "Haryana", "years_experience": 3,
    "practice_areas": ["Criminal"], "jurisdictions": ["Punjab and Haryana High Court"],
}
FEE = {"hourly_rate": 1500}


def _put(client, body, user=NEW):
    return client.put("/api/v1/lawyers/me", headers=auth("advocate", user), json=body)


def test_a_new_advocate_starts_with_everything_missing(client) -> None:
    listing = client.get("/api/v1/lawyers/me", headers=auth("advocate", NEW)).json()
    assert set(listing["missing_required"]) == {
        "full_name", "bar_council_id", "pincode", "city", "location_state", "years_experience",
        "practice_areas", "jurisdictions", "hourly_rate",
    }
    assert listing["listed"] is False


def test_setup_steps_save_without_a_fee_then_the_fee_completes_it(client) -> None:
    assert _put(client, STEP1).status_code == 200
    after_step2 = _put(client, STEP2).json()
    assert after_step2["missing_required"] == ["hourly_rate"]
    done = _put(client, FEE)
    assert done.status_code == 200, done.text
    assert done.json()["missing_required"] == []


def test_a_fee_cannot_be_saved_on_an_incomplete_listing_and_nothing_is_written(client) -> None:
    _put(client, STEP1)
    resp = _put(client, {**FEE, "pincode": "135001", "bio": "Changed"})
    assert resp.status_code == 422
    fields = resp.json()["detail"]["fields"]
    assert set(fields) == {"city", "location_state", "years_experience", "practice_areas", "jurisdictions"}
    after = client.get("/api/v1/lawyers/me", headers=auth("advocate", NEW)).json()
    assert after["pincode"] == "" and after["hourly_rate"] is None and after["bio"] == ""


def test_formats_are_checked_on_every_save(client) -> None:
    for bad in ({"pincode": "012345"}, {"pincode": "12345"}, {"hourly_rate": 0}, {"hourly_rate": 1500.5},
                {"years_experience": 71}):
        assert _put(client, bad).status_code == 422, bad


def test_less_than_a_year_is_a_real_answer_and_experience_stays_current(client) -> None:
    _put(client, {**STEP1, **STEP2, "years_experience": 0})
    listing = client.get("/api/v1/lawyers/me", headers=auth("advocate", NEW)).json()
    assert listing["years_experience"] == 0 and listing["practising_since"] == current_year()
    assert "years_experience" not in listing["missing_required"]

    # Next year the same listing reads one year more, without anyone saving it.
    lawyer = SimpleNamespace(practising_since=current_year() - 1, years_experience=0)
    assert experience_years(lawyer) == 1


def test_older_listings_count_a_filled_in_number_but_not_the_old_default(client) -> None:
    base = dict(full_name="A B", bar_council_id="D/1/2000", pincode="110001", city="Delhi",
                location_state="Delhi", practice_areas=["Tax"], jurisdictions=["Delhi High Court"],
                hourly_rate=1000, practising_since=None)
    assert "years_experience" not in missing_required(SimpleNamespace(**base, years_experience=12))
    assert "years_experience" in missing_required(SimpleNamespace(**base, years_experience=0))


def test_listed_advocates_missing_details_stay_listed_but_must_complete_to_save(client) -> None:
    # The seeded advocate has a fee and verification but no pincode or state.
    me = client.get("/api/v1/lawyers/me", headers=auth("advocate")).json()
    assert me["listed"] is True and {"pincode", "location_state"} <= set(me["missing_required"])
    assert me["full_name"] in {r["full_name"] for r in client.get("/api/v1/lawyers", headers=auth("citizen")).json()}

    blocked = client.put("/api/v1/lawyers/me", headers=auth("advocate"), json={"bio": "Updated bio"})
    assert blocked.status_code == 422 and "pincode" in blocked.json()["detail"]["fields"]
    fixed = client.put("/api/v1/lawyers/me", headers=auth("advocate"),
                       json={"pincode": "110001", "location_state": "Delhi", "bio": "Updated bio"})
    assert fixed.status_code == 200 and fixed.json()["missing_required"] == []


def test_admins_follow_the_same_rule(client) -> None:
    resp = client.put(f"/api/v1/admin/lawyers/by-user/{NEW}/listing", headers=auth("admin"),
                      json={**STEP1, **FEE})
    assert resp.status_code == 422 and "pincode" in resp.json()["detail"]["fields"]


def _lawyer(**extra):
    return SimpleNamespace(id=uuid.uuid4(), full_name="Ashu", bar_council_id=None, is_verified=False,
                           verification_data=None, verified_at=None, **extra)


def test_unsupported_council_goes_to_manual_review_without_satyapan(monkeypatch) -> None:
    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: (_ for _ in ()).throw(AssertionError("called")))
    lawyer = _lawyer()
    resp = asyncio.run(api._verify_enrollment(lawyer, "MAH/123/2015", "other"))
    assert resp.status == "needs_review" and not lawyer.is_verified
    assert lawyer.bar_council_id == "MAH/123/2015"
    assert lawyer.verification_data["review_reason"] == "council_not_supported"

    asked = _lawyer()
    asyncio.run(api._verify_enrollment(asked, "PH/1/2026", "Punjab & Haryana", manual_review=True))
    assert asked.verification_data["review_reason"] == "manual_request"
