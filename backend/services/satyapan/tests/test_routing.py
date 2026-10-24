"""Detecting the State Bar Council from the enrolment number and routing to its verifier."""

import asyncio

import pytest

from app.services import verification_service as vs


@pytest.mark.parametrize(
    ("number", "council"),
    [
        ("UP1234/2010", "Uttar Pradesh"),
        ("up1234/2010", "Uttar Pradesh"),  # case-insensitive
        ("D/105/2005", "Delhi"),
        ("AP/9/1999", "Andhra Pradesh"),
        ("R/176A/1978", "Rajasthan"),
        ("P/1150/1993", "Punjab & Haryana"),
        ("PH/6475/2023", "Punjab & Haryana"),
        ("ph-6475-2023", "Punjab & Haryana"),  # dash variant
        ("PH 6475 2023", "Punjab & Haryana"),  # space variant
        ("MAH/1/2015", None),  # a state we don't serve
        ("1234/2020", None),  # no prefix
        ("", None),
    ],
)
def test_detect_council(number: str, council: str | None) -> None:
    assert vs.detect_council(number) == council


class _FakeVerifier:
    """Records the number it was asked to verify instead of scraping a live site."""

    calls: list[str] = []

    async def verify(self, enrollment_number: str) -> dict:
        type(self).calls.append(enrollment_number)
        return {"status": "success", "data": {"enrollment_number": enrollment_number}}


def _fake_councils() -> dict:
    """A BAR_COUNCILS-shaped map with a distinct fake verifier per council."""
    return {
        name: (type(f"Fake_{name}", (_FakeVerifier,), {"calls": []}), aliases)
        for name, (_real, aliases) in vs.BAR_COUNCILS.items()
    }


def test_routes_by_the_number_alone(monkeypatch) -> None:
    fakes = _fake_councils()
    monkeypatch.setattr(vs, "BAR_COUNCILS", fakes)
    asyncio.run(vs.VerificationService().verify_lawyer("D/105/2005"))  # no state passed
    assert fakes["Delhi"][0].calls == ["D/105/2005"]
    assert fakes["Uttar Pradesh"][0].calls == []


def test_the_number_wins_over_a_mismatched_state(monkeypatch) -> None:
    fakes = _fake_councils()
    monkeypatch.setattr(vs, "BAR_COUNCILS", fakes)
    asyncio.run(vs.VerificationService().verify_lawyer("UP1234/2010", state="Delhi"))
    assert fakes["Uttar Pradesh"][0].calls == ["UP1234/2010"]
    assert fakes["Delhi"][0].calls == []


def test_state_is_only_a_fallback_for_unknown_prefixes(monkeypatch) -> None:
    fakes = _fake_councils()
    monkeypatch.setattr(vs, "BAR_COUNCILS", fakes)
    asyncio.run(vs.VerificationService().verify_lawyer("12345/2020", state="Rajasthan"))
    assert fakes["Rajasthan"][0].calls == ["12345/2020"]


def test_undetectable_number_raises(monkeypatch) -> None:
    monkeypatch.setattr(vs, "BAR_COUNCILS", _fake_councils())
    with pytest.raises(ValueError) as err:
        asyncio.run(vs.VerificationService().verify_lawyer("MAH/1/2015"))
    assert "Could not determine" in str(err.value)
