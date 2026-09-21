"""MeraBakil email brand tokens — aligned with frontend design system."""
from __future__ import annotations

import base64
import os
from functools import lru_cache
from pathlib import Path

BRAND_NAME = "MeraBakil"
DEFAULT_FRONTEND_URL = "https://merabakil.in"
SUPPORT_EMAIL = "admin@merabakil.in"

_ASSETS_DIR = Path(__file__).resolve().parent / "assets"

COLORS = {
    "primary": "#B45309",
    "primary_dark": "#92400E",
    "background": "#FAF7F2",
    "card": "#FFFFFF",
    "text": "#1C1410",
    "muted": "#6B5E54",
    "border": "#E8DFD4",
    "success": "#059669",
    "success_bg": "#ECFDF5",
    "warning": "#D97706",
    "warning_bg": "#FFFBEB",
    "error": "#DC2626",
    "error_bg": "#FEF2F2",
    "header_bg": "#FFFDF9",
}


def normalize_frontend_url(frontend_url: str | None = None) -> str:
    return (frontend_url or DEFAULT_FRONTEND_URL).rstrip("/")


def email_asset_base_url(frontend_url: str | None = None) -> str:
    """Base URL for hosted email images (fallback when bundled assets are unavailable)."""
    override = os.getenv("EMAIL_ASSET_BASE_URL", "").strip()
    if override:
        return override.rstrip("/")
    url = normalize_frontend_url(frontend_url)
    if "localhost" in url or "127.0.0.1" in url:
        return DEFAULT_FRONTEND_URL
    return url


@lru_cache(maxsize=32)
def _embedded_png(relative_path: str) -> str:
    """Inline PNG as a data URI so images render without external hosting."""
    path = _ASSETS_DIR / relative_path
    if not path.is_file():
        msg = f"Missing bundled email asset: {relative_path}"
        raise FileNotFoundError(msg)
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def logo_url(frontend_url: str | None = None) -> str:
    return mark_url(frontend_url)


def mark_url(frontend_url: str | None = None) -> str:
    del frontend_url
    return _embedded_png("mark-light.png")


def icon_url(frontend_url: str | None, name: str) -> str:
    del frontend_url
    return _embedded_png(f"icons/{name}.png")


def brand_context(frontend_url: str | None = None) -> dict[str, str | dict[str, str]]:
    url = normalize_frontend_url(frontend_url)
    return {
        "brand_name": BRAND_NAME,
        "frontend_url": url,
        "asset_base_url": email_asset_base_url(frontend_url),
        "logo_url": logo_url(frontend_url),
        "mark_url": mark_url(frontend_url),
        "support_email": SUPPORT_EMAIL,
        "colors": COLORS,
    }
