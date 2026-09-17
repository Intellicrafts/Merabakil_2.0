"""MeraBakil email brand tokens — aligned with frontend design system."""
from __future__ import annotations

BRAND_NAME = "MeraBakil"
DEFAULT_FRONTEND_URL = "https://merabakil.in"
SUPPORT_EMAIL = "support@merabakil.in"

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


def logo_url(frontend_url: str | None = None) -> str:
    return f"{normalize_frontend_url(frontend_url)}/brand/logo-light.png"


def mark_url(frontend_url: str | None = None) -> str:
    return f"{normalize_frontend_url(frontend_url)}/brand/mark-light.png"


def icon_url(frontend_url: str | None, name: str) -> str:
    return f"{normalize_frontend_url(frontend_url)}/email/icons/{name}.png"


def brand_context(frontend_url: str | None = None) -> dict[str, str | dict[str, str]]:
    url = normalize_frontend_url(frontend_url)
    return {
        "brand_name": BRAND_NAME,
        "frontend_url": url,
        "logo_url": logo_url(url),
        "mark_url": mark_url(url),
        "support_email": SUPPORT_EMAIL,
        "colors": COLORS,
    }
