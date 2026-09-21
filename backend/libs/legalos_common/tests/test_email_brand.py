"""Tests for email asset URL resolution."""

from __future__ import annotations

from legalos_common.email.brand import (
    DEFAULT_FRONTEND_URL,
    SUPPORT_EMAIL,
    email_asset_base_url,
    icon_url,
    mark_url,
)


def test_localhost_frontend_uses_production_asset_host() -> None:
    assert email_asset_base_url("http://localhost:3000") == DEFAULT_FRONTEND_URL


def test_mark_and_icon_use_embedded_assets() -> None:
    mark = mark_url("https://merabakil.in")
    icon = icon_url("https://merabakil.in", "lock")
    assert mark.startswith("data:image/png;base64,")
    assert icon.startswith("data:image/png;base64,")


def test_support_email_is_admin() -> None:
    assert SUPPORT_EMAIL == "admin@merabakil.in"
