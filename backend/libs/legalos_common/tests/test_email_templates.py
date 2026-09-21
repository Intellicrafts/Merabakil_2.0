"""Unit tests for premium HTML email templates."""

from __future__ import annotations

from legalos_common.email.brand import BRAND_NAME, SUPPORT_EMAIL
from legalos_common.email.templates import (
    appointment_cancelled_email,
    appointment_confirmed_email,
    appointment_rejected_email,
    booking_created_email,
    email_verification_otp_email,
    login_otp_email,
    password_reset_email,
    welcome_email,
)

FRONTEND = "https://merabakil.in"
EMBEDDED_IMG = "data:image/png;base64,"


def test_welcome_email_renders_branded_html() -> None:
    subject, html, text = welcome_email("Priya Sharma", "citizen", frontend_url=FRONTEND)
    assert subject == f"{BRAND_NAME} · Welcome to your account"
    assert EMBEDDED_IMG in html
    assert "Legal Help. Made Simple." in html
    assert "#B45309" in html
    assert "Priya Sharma" in html
    assert f"{FRONTEND}/dashboard" in html
    assert "Priya Sharma" in text
    assert SUPPORT_EMAIL in html


def test_email_verification_otp_email_renders() -> None:
    subject, html, text = email_verification_otp_email(
        "user@example.com", "482910", frontend_url=FRONTEND
    )
    assert "Verify your email" in subject
    assert "482910" not in html[:400]  # preheader should not expose OTP digits
    assert EMBEDDED_IMG in html
    assert "482910" in html
    assert "482910" in text


def test_login_otp_email_renders() -> None:
    subject, html, text = login_otp_email(
        "Priya Sharma", "739204", frontend_url=FRONTEND
    )
    assert "sign-in code" in subject
    assert EMBEDDED_IMG in html
    assert "739204" in html
    assert "Priya Sharma" in text
    assert SUPPORT_EMAIL in html


def test_password_reset_email_renders() -> None:
    reset_url = f"{FRONTEND}/reset-password?token=abc123"
    subject, html, text = password_reset_email(
        "Rahul Verma", reset_url, frontend_url=FRONTEND
    )
    assert "Reset your password" in subject
    assert EMBEDDED_IMG in html
    assert reset_url in html
    assert reset_url in text


def test_booking_created_email_renders() -> None:
    apt_url = f"{FRONTEND}/appointments/apt-1"
    subject, html, text = booking_created_email(
        "Adv. Mehta",
        "Anita Singh",
        "12 Sep 2026",
        "10:00 AM",
        apt_url,
        frontend_url=FRONTEND,
    )
    assert "New consultation booked" in subject
    assert EMBEDDED_IMG in html
    assert "Pending review" in html
    assert apt_url in html
    assert "Anita Singh" in text


def test_appointment_confirmed_email_renders() -> None:
    apt_url = f"{FRONTEND}/appointments/apt-2"
    subject, html, text = appointment_confirmed_email(
        "Anita Singh",
        "Adv. Mehta",
        "12 Sep 2026",
        "10:00 AM",
        apt_url,
        frontend_url=FRONTEND,
    )
    assert "Consultation confirmed" in subject
    assert EMBEDDED_IMG in html
    assert "Confirmed" in html
    assert apt_url in html


def test_appointment_rejected_email_renders() -> None:
    subject, html, text = appointment_rejected_email(
        "Anita Singh",
        "Adv. Mehta",
        "12 Sep 2026",
        "10:00 AM",
        frontend_url=FRONTEND,
    )
    assert subject == f"{BRAND_NAME} · Consultation request not accepted"
    assert EMBEDDED_IMG in html
    assert f"{FRONTEND}/lawyer-marketplace" in html
    assert f"{FRONTEND}/lawyer-marketplace" in text


def test_appointment_cancelled_email_renders() -> None:
    subject, html, text = appointment_cancelled_email(
        "Anita Singh",
        "Adv. Mehta",
        "12 Sep 2026",
        "10:00 AM",
        frontend_url=FRONTEND,
    )
    assert "Consultation cancelled" in subject
    assert EMBEDDED_IMG in html
    assert "Cancelled" in html
    assert f"{FRONTEND}/lawyer-marketplace" in html


def test_templates_do_not_use_legacy_navy_palette() -> None:
    _, html, _ = welcome_email("Test User", "citizen", frontend_url=FRONTEND)
    assert "#1a3a5c" not in html
    assert "#2563eb" not in html
