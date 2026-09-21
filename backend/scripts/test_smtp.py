#!/usr/bin/env python3
"""Send a test transactional email via configured SMTP.

Usage:
  .venv/bin/python backend/scripts/test_smtp.py recipient@example.com
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "backend" / "libs" / "legalos_common"))

from legalos_common.config.settings import SmtpSettings
from legalos_common.email.client import AsyncEmailClient
from legalos_common.email.templates import login_otp_email


async def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: test_smtp.py recipient@example.com", file=sys.stderr)
        return 1

    recipient = sys.argv[1].strip()
    settings = SmtpSettings()
    client = AsyncEmailClient(settings)

    print("SMTP configuration check")
    print(f"  enabled:   {settings.smtp_enabled}")
    print(f"  host:      {settings.smtp_host}:{settings.smtp_port}")
    print(f"  username:  {settings.smtp_username or '(empty)'}")
    print(f"  from:      {settings.smtp_from_name} <{settings.smtp_from_email}>")
    print(f"  reply-to:  {settings.smtp_reply_to}")
    print(f"  aligned:   {settings.is_from_aligned()}")

    warnings = client.validate_config()
    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(f"  - {w}")
        print("\nSee docs/EMAIL_DELIVERABILITY.md for Google Workspace + DNS setup.")

    subject, html, text = login_otp_email(
        "Test User",
        "123456",
        frontend_url="https://merabakil.in",
    )

    print(f"\nSending test email to {recipient} ...")
    ok = await client.send(
        to_email=recipient,
        to_name="Test User",
        subject=subject,
        html=html,
        text=text,
    )
    if ok:
        print("Sent successfully.")
        print("Verify in Gmail: Show original → SPF/DKIM/DMARC should PASS.")
        return 0

    print(f"Send failed: {client.last_error}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
