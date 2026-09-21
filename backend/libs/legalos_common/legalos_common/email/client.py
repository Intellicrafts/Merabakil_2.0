"""Async email client (Google Workspace SMTP / STARTTLS)."""
from __future__ import annotations

import logging
import uuid
from email.utils import formataddr, make_msgid

import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from legalos_common.config.settings import SmtpSettings

logger = logging.getLogger(__name__)


class AsyncEmailClient:
    def __init__(self, settings: SmtpSettings) -> None:
        self._s = settings
        self._last_error: str | None = None

    @property
    def last_error(self) -> str | None:
        return self._last_error

    def validate_config(self) -> list[str]:
        """Return human-readable configuration warnings."""
        warnings: list[str] = []
        if not self._s.smtp_enabled:
            warnings.append("SMTP is disabled (SMTP_ENABLED=false).")
        if self._s.smtp_enabled and not self._s.smtp_username:
            warnings.append("SMTP_USERNAME is empty.")
        if self._s.smtp_enabled and not self._s.smtp_password:
            warnings.append("SMTP_PASSWORD is empty.")
        if self._s.smtp_enabled and self._s.smtp_username and not self._s.is_from_aligned():
            warnings.append(
                f"SMTP_FROM_EMAIL ({self._s.smtp_from_email}) domain does not match "
                f"SMTP_USERNAME ({self._s.smtp_username}) — emails may land in spam."
            )
        return warnings

    def is_configured(self) -> bool:
        return bool(self._s.smtp_enabled and self._s.smtp_username and self._s.smtp_password)

    async def send(
        self,
        *,
        to_email: str,
        to_name: str,
        subject: str,
        html: str,
        text: str | None = None,
    ) -> bool:
        """Send HTML email with plain-text alternative. Returns True if sent."""
        self._last_error = None
        if not self.is_configured():
            self._last_error = "SMTP not configured"
            logger.warning(
                "email_skipped to=%s subject=%s reason=smtp_not_configured",
                to_email,
                subject,
            )
            return False

        for warning in self.validate_config():
            logger.warning("email_config: %s", warning)

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = formataddr((self._s.smtp_from_name, self._s.smtp_from_email))
            msg["To"] = formataddr((to_name, to_email)) if to_name else to_email
            msg["Reply-To"] = self._s.smtp_reply_to
            msg["Message-ID"] = make_msgid(domain=self._s.from_domain())
            msg["MIME-Version"] = "1.0"
            msg["Auto-Submitted"] = "auto-generated"
            msg["X-Entity-Ref-ID"] = str(uuid.uuid4())

            plain = text or "Please view this email in an HTML-capable client."
            msg.attach(MIMEText(plain, "plain", "utf-8"))
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
            return True
        except Exception as exc:
            self._last_error = str(exc)
            logger.warning("email_failed to=%s subject=%s error=%s", to_email, subject, exc)
            return False
