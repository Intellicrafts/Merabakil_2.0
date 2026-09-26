"""Fetch extracted text for user-uploaded documents."""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)


class DocumentTextClient:
    def __init__(self, base_url: str) -> None:
        self._base = base_url.rstrip("/")

    async def _fetch_one(
        self,
        client: httpx.AsyncClient,
        doc_id: str,
        headers: dict,
    ) -> tuple[str, str] | None:
        try:
            resp = await client.get(
                f"{self._base}/api/v1/documents/{doc_id}/text",
                headers=headers,
            )
            if resp.status_code != 200:
                logger.warning("document_text_unavailable status=%s", resp.status_code)
                return None
            body = resp.json()
            title = body.get("title") or body.get("filename") or doc_id
            text = (body.get("text") or "").strip()
            if text:
                return (title, text)
            filename = (body.get("filename") or "").lower()
            if filename.endswith((".jpg", ".jpeg", ".png", ".webp")):
                return (
                    title,
                    "[Image uploaded — no extracted text available. Ask the user to describe the image or re-upload a clearer photo.]",
                )
            return None
        except Exception as exc:
            logger.warning("document_text_fetch_failed document_id=%s error=%s", doc_id, exc)
            return None

    async def fetch_full(self, document_id: str, *, user_token: str | None) -> tuple[str, str] | None:
        """(title, full extracted text) if this user may read the document, else None."""
        if not user_token:
            return None
        async with httpx.AsyncClient(timeout=10.0) as client:
            return await self._fetch_one(client, document_id, {"Authorization": f"Bearer {user_token}"})

    async def can_access(self, document_id: str, *, user_token: str) -> bool:
        """True when the document service lets this user read the document."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{self._base}/api/v1/documents/{document_id}/text",
                    headers={"Authorization": f"Bearer {user_token}"},
                )
            return resp.status_code == 200
        except Exception as exc:
            logger.warning("document_access_check_failed error=%s", exc)
            return False
