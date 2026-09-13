"""Email templates — returns (subject, html) tuples."""
from __future__ import annotations

_BRAND = "MeraBakil"
_COLOR = "#1a3a5c"
_CTA_COLOR = "#2563eb"

_BASE = """
<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:{brand_color};padding:24px 32px;">
        <span style="color:#ffffff;font-size:22px;font-weight:700;">{brand}</span>
      </td></tr>
      <tr><td style="padding:32px;">
        {body}
      </td></tr>
      <tr><td style="background:#f4f6f9;padding:16px 32px;text-align:center;">
        <span style="color:#9ca3af;font-size:12px;">© 2026 {brand}. All rights reserved.</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>
"""

_BTN = '<a href="{url}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:{color};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">{label}</a>'


def _render(body: str) -> str:
    return _BASE.format(brand=_BRAND, brand_color=_COLOR, body=body)


def welcome_email(full_name: str, role: str) -> tuple[str, str]:
    role_label = "advocate" if role == "advocate" else "citizen"
    subject = f"Welcome to {_BRAND}!"
    body = f"""
<h2 style="color:{_COLOR};margin-top:0;">Welcome, {full_name}!</h2>
<p style="color:#374151;line-height:1.6;">
  Your {_BRAND} account has been created as a <strong>{role_label}</strong>.
  You're all set to explore AI-powered legal assistance.
</p>
<p style="color:#374151;line-height:1.6;">
  {"Find the right advocate for your legal matters." if role_label == "citizen" else "Discover new clients and manage your consultations."}
</p>
{_BTN.format(url="https://merabakil.in/dashboard", label="Go to Dashboard", color=_CTA_COLOR)}
"""
    return subject, _render(body)


def password_reset_email(full_name: str, reset_url: str) -> tuple[str, str]:
    subject = f"{_BRAND} — Reset your password"
    body = f"""
<h2 style="color:{_COLOR};margin-top:0;">Reset your password</h2>
<p style="color:#374151;line-height:1.6;">Hi {full_name},</p>
<p style="color:#374151;line-height:1.6;">
  We received a request to reset your password. Click the button below within <strong>1 hour</strong>.
  If you didn't request this, you can safely ignore this email.
</p>
{_BTN.format(url=reset_url, label="Reset Password", color=_CTA_COLOR)}
<p style="color:#9ca3af;font-size:12px;margin-top:24px;">
  Or copy this link: <a href="{reset_url}" style="color:{_CTA_COLOR};">{reset_url}</a>
</p>
"""
    return subject, _render(body)


def booking_created_email(
    lawyer_name: str,
    citizen_name: str,
    date_str: str,
    time_str: str,
    appointment_url: str,
) -> tuple[str, str]:
    subject = f"New consultation booked — {date_str}"
    body = f"""
<h2 style="color:{_COLOR};margin-top:0;">New consultation booked</h2>
<p style="color:#374151;line-height:1.6;">Hi {lawyer_name},</p>
<p style="color:#374151;line-height:1.6;">
  <strong>{citizen_name}</strong> has booked a consultation with you.
</p>
<table style="background:#f8fafc;border-radius:6px;padding:16px 20px;margin:16px 0;width:100%;">
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0;">Date</td><td style="font-weight:600;color:#111827;">{date_str}</td></tr>
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0;">Time</td><td style="font-weight:600;color:#111827;">{time_str}</td></tr>
</table>
<p style="color:#374151;line-height:1.6;">Please confirm or reject the appointment at your earliest convenience.</p>
{_BTN.format(url=appointment_url, label="View Appointment", color=_CTA_COLOR)}
"""
    return subject, _render(body)


def appointment_confirmed_email(
    citizen_name: str,
    lawyer_name: str,
    date_str: str,
    time_str: str,
    appointment_url: str,
) -> tuple[str, str]:
    subject = f"Consultation confirmed — {date_str}"
    body = f"""
<h2 style="color:{_COLOR};margin-top:0;">Your consultation is confirmed</h2>
<p style="color:#374151;line-height:1.6;">Hi {citizen_name},</p>
<p style="color:#374151;line-height:1.6;">
  <strong>{lawyer_name}</strong> has confirmed your consultation.
</p>
<table style="background:#f0fdf4;border-radius:6px;padding:16px 20px;margin:16px 0;width:100%;">
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0;">Date</td><td style="font-weight:600;color:#111827;">{date_str}</td></tr>
  <tr><td style="color:#6b7280;font-size:13px;padding:4px 0;">Time</td><td style="font-weight:600;color:#111827;">{time_str}</td></tr>
</table>
{_BTN.format(url=appointment_url, label="View Appointment", color=_CTA_COLOR)}
"""
    return subject, _render(body)


def appointment_rejected_email(
    citizen_name: str,
    lawyer_name: str,
    date_str: str,
    time_str: str,
) -> tuple[str, str]:
    subject = "Consultation request not accepted"
    body = f"""
<h2 style="color:{_COLOR};margin-top:0;">Consultation not accepted</h2>
<p style="color:#374151;line-height:1.6;">Hi {citizen_name},</p>
<p style="color:#374151;line-height:1.6;">
  Unfortunately, <strong>{lawyer_name}</strong> could not accept your consultation request
  for <strong>{date_str} at {time_str}</strong>.
</p>
<p style="color:#374151;line-height:1.6;">
  You can browse other advocates and book a new consultation.
</p>
{_BTN.format(url="https://merabakil.in/lawyer-marketplace", label="Find Another Advocate", color=_CTA_COLOR)}
"""
    return subject, _render(body)


def appointment_cancelled_email(
    recipient_name: str,
    other_name: str,
    date_str: str,
    time_str: str,
) -> tuple[str, str]:
    subject = f"Consultation cancelled — {date_str}"
    body = f"""
<h2 style="color:{_COLOR};margin-top:0;">Consultation cancelled</h2>
<p style="color:#374151;line-height:1.6;">Hi {recipient_name},</p>
<p style="color:#374151;line-height:1.6;">
  <strong>{other_name}</strong> has cancelled the consultation scheduled for
  <strong>{date_str} at {time_str}</strong>.
</p>
{_BTN.format(url="https://merabakil.in/lawyer-marketplace", label="Find Another Advocate", color=_CTA_COLOR)}
"""
    return subject, _render(body)
