"""Email templates — returns (subject, html, text) tuples."""
from __future__ import annotations

from legalos_common.email.brand import BRAND_NAME, brand_context, icon_url, normalize_frontend_url
from legalos_common.email.renderer import render

__all__ = [
    "welcome_email",
    "password_reset_email",
    "booking_created_email",
    "appointment_confirmed_email",
    "appointment_rejected_email",
    "appointment_cancelled_email",
]


def _ctx(frontend_url: str | None = None, **extra: object) -> dict[str, object]:
    ctx: dict[str, object] = brand_context(frontend_url)
    ctx.update(extra)
    return ctx


def welcome_email(
    full_name: str,
    role: str,
    *,
    frontend_url: str | None = None,
) -> tuple[str, str, str]:
    url = normalize_frontend_url(frontend_url)
    role_label = "advocate" if role == "advocate" else "citizen"
    role_message = (
        "Discover new clients and manage your consultations."
        if role_label == "advocate"
        else "Find the right advocate for your legal matters."
    )
    subject = f"Welcome to {BRAND_NAME}!"
    html = render(
        "welcome.html",
        **_ctx(
            frontend_url,
            preheader=f"Your {BRAND_NAME} account is ready — get started today.",
            full_name=full_name,
            role_label=role_label,
            role_message=role_message,
            dashboard_url=f"{url}/dashboard",
        ),
    )
    text = (
        f"Welcome to {BRAND_NAME}, {full_name}!\n\n"
        f"Your account has been created as a {role_label}.\n"
        f"{role_message}\n\n"
        f"Go to your dashboard: {url}/dashboard"
    )
    return subject, html, text


def password_reset_email(
    full_name: str,
    reset_url: str,
    *,
    frontend_url: str | None = None,
) -> tuple[str, str, str]:
    subject = f"{BRAND_NAME} — Reset your password"
    html = render(
        "password_reset.html",
        **_ctx(
            frontend_url,
            preheader="Reset your MeraBakil password within 1 hour.",
            full_name=full_name,
            reset_url=reset_url,
        ),
    )
    text = (
        f"Hi {full_name},\n\n"
        "We received a request to reset your password. "
        "Use the link below within 1 hour:\n\n"
        f"{reset_url}\n\n"
        "If you didn't request this, you can safely ignore this email."
    )
    return subject, html, text


def booking_created_email(
    lawyer_name: str,
    citizen_name: str,
    date_str: str,
    time_str: str,
    appointment_url: str,
    *,
    frontend_url: str | None = None,
) -> tuple[str, str, str]:
    subject = f"New consultation booked — {date_str}"
    html = render(
        "booking_created.html",
        **_ctx(
            frontend_url,
            preheader=f"{citizen_name} booked a consultation on {date_str}.",
            lawyer_name=lawyer_name,
            citizen_name=citizen_name,
            date_str=date_str,
            time_str=time_str,
            appointment_url=appointment_url,
        ),
    )
    text = (
        f"Hi {lawyer_name},\n\n"
        f"{citizen_name} has booked a consultation with you.\n"
        f"Date: {date_str}\n"
        f"Time: {time_str}\n\n"
        f"View appointment: {appointment_url}"
    )
    return subject, html, text


def appointment_confirmed_email(
    citizen_name: str,
    lawyer_name: str,
    date_str: str,
    time_str: str,
    appointment_url: str,
    *,
    frontend_url: str | None = None,
) -> tuple[str, str, str]:
    subject = f"Consultation confirmed — {date_str}"
    html = render(
        "appointment_confirmed.html",
        **_ctx(
            frontend_url,
            preheader=f"{lawyer_name} confirmed your consultation on {date_str}.",
            citizen_name=citizen_name,
            lawyer_name=lawyer_name,
            date_str=date_str,
            time_str=time_str,
            appointment_url=appointment_url,
        ),
    )
    text = (
        f"Hi {citizen_name},\n\n"
        f"{lawyer_name} has confirmed your consultation.\n"
        f"Date: {date_str}\n"
        f"Time: {time_str}\n\n"
        f"View appointment: {appointment_url}"
    )
    return subject, html, text


def appointment_rejected_email(
    citizen_name: str,
    lawyer_name: str,
    date_str: str,
    time_str: str,
    *,
    frontend_url: str | None = None,
) -> tuple[str, str, str]:
    url = normalize_frontend_url(frontend_url)
    marketplace_url = f"{url}/lawyer-marketplace"
    subject = "Consultation request not accepted"
    html = render(
        "appointment_rejected.html",
        **_ctx(
            frontend_url,
            preheader=f"{lawyer_name} could not accept your consultation request.",
            citizen_name=citizen_name,
            lawyer_name=lawyer_name,
            date_str=date_str,
            time_str=time_str,
            marketplace_url=marketplace_url,
        ),
    )
    text = (
        f"Hi {citizen_name},\n\n"
        f"{lawyer_name} could not accept your consultation request "
        f"for {date_str} at {time_str}.\n\n"
        f"Find another advocate: {marketplace_url}"
    )
    return subject, html, text


def appointment_cancelled_email(
    recipient_name: str,
    other_name: str,
    date_str: str,
    time_str: str,
    *,
    frontend_url: str | None = None,
) -> tuple[str, str, str]:
    url = normalize_frontend_url(frontend_url)
    marketplace_url = f"{url}/lawyer-marketplace"
    subject = f"Consultation cancelled — {date_str}"
    html = render(
        "appointment_cancelled.html",
        **_ctx(
            frontend_url,
            preheader=f"{other_name} cancelled the consultation on {date_str}.",
            recipient_name=recipient_name,
            other_name=other_name,
            date_str=date_str,
            time_str=time_str,
            marketplace_url=marketplace_url,
        ),
    )
    text = (
        f"Hi {recipient_name},\n\n"
        f"{other_name} has cancelled the consultation scheduled for "
        f"{date_str} at {time_str}.\n\n"
        f"Browse advocates: {marketplace_url}"
    )
    return subject, html, text
