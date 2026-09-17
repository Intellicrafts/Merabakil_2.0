"""Async fire-and-forget email client (Gmail SMTP / STARTTLS)."""
from __future__ import annotations

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib

from legalos_common.config.settings import SmtpSettings

logger = logging.getLogger(__name__)


class AsyncEmailClient:
    def __init__(self, settings: SmtpSettings) -> None:
        self._s = settings

    async def send(
        self,
        *,
        to_email: str,
        to_name: str,
        subject: str,
        html: str,
        text: str | None = None,
    ) -> None:
        """Send HTML email with optional plain-text alternative. Never raises."""
        if not self._s.smtp_enabled or not self._s.smtp_username:
            logger.debug("email_skipped to=%s subject=%s (smtp disabled)", to_email, subject)
            return
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self._s.smtp_from_name} <{self._s.smtp_from_email}>"
            msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email
            if text:
                msg.attach(MIMEText(text, "plain", "utf-8"))
            msg.attach(MIMEText(html, "html", "utf-8"))
            await aiosmtplib.send(
                msg,
                hostname=self._s.smtp_host,
                port=self._s.smtp_port,
                username=self._s.smtp_username,
                password=self._s.smtp_password,
                start_tls=True,
            )
            logger.info("email_sent to=%s subject=%s", to_email, subject)
        except Exception as exc:
            logger.warning("email_failed to=%s subject=%s error=%s", to_email, subject, exc)
