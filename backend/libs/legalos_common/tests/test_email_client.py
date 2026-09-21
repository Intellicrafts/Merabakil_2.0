"""Unit tests for AsyncEmailClient deliverability headers."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from legalos_common.config.settings import SmtpSettings
from legalos_common.email.client import AsyncEmailClient


@pytest.fixture
def smtp_settings() -> SmtpSettings:
    return SmtpSettings(
        smtp_enabled=True,
        smtp_username="notifications@merabakil.in",
        smtp_password="app-password",
        smtp_from_email="notifications@merabakil.in",
        smtp_from_name="MeraBakil",
        smtp_reply_to="admin@merabakil.in",
    )


def test_validate_config_warns_on_from_mismatch() -> None:
    settings = SmtpSettings(
        smtp_enabled=True,
        smtp_username="user@gmail.com",
        smtp_from_email="noreply@merabakil.in",
    )
    client = AsyncEmailClient(settings)
    warnings = client.validate_config()
    assert any("does not match" in w for w in warnings)


def test_is_from_aligned() -> None:
    settings = SmtpSettings(
        smtp_username="notifications@merabakil.in",
        smtp_from_email="notifications@merabakil.in",
    )
    assert settings.is_from_aligned() is True


@pytest.mark.asyncio
async def test_send_returns_false_when_disabled() -> None:
    settings = SmtpSettings(smtp_enabled=False)
    client = AsyncEmailClient(settings)
    ok = await client.send(
        to_email="a@example.com",
        to_name="A",
        subject="Test",
        html="<p>Hi</p>",
        text="Hi",
    )
    assert ok is False


@pytest.mark.asyncio
async def test_send_adds_deliverability_headers(smtp_settings: SmtpSettings) -> None:
    client = AsyncEmailClient(smtp_settings)
    captured: dict = {}

    async def fake_send(msg, **kwargs):
        captured["msg"] = msg

    with patch("legalos_common.email.client.aiosmtplib.send", new=AsyncMock(side_effect=fake_send)):
        ok = await client.send(
            to_email="user@example.com",
            to_name="User",
            subject="MeraBakil · Test",
            html="<p>Hello</p>",
            text="Hello",
        )

    assert ok is True
    msg = captured["msg"]
    assert msg["Reply-To"] == "admin@merabakil.in"
    assert msg["Message-ID"]
    assert msg["MIME-Version"] == "1.0"
    assert msg["Auto-Submitted"] == "auto-generated"
    assert msg["X-Entity-Ref-ID"]


@pytest.mark.asyncio
async def test_send_returns_false_on_smtp_error(smtp_settings: SmtpSettings) -> None:
    client = AsyncEmailClient(smtp_settings)
    with patch(
        "legalos_common.email.client.aiosmtplib.send",
        new=AsyncMock(side_effect=RuntimeError("smtp down")),
    ):
        ok = await client.send(
            to_email="user@example.com",
            to_name="User",
            subject="Test",
            html="<p>Hi</p>",
        )
    assert ok is False
    assert client.last_error == "smtp down"
