"""Fetch extracted text for user-uploaded documents."""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

TEXT_CHAR_BUDGET = 24_000


class DocumentTextClient:
    def __init__(self, base_url: str) -> None:
        self._base = base_url.rstrip("/")

    async def fetch_excerpts(
        self,
        document_ids: list[str],
        *,
        user_token: str | None,
    ) -> str:
        if not document_ids or not user_token:
            return ""
        parts: list[str] = []
        used = 0
        headers = {"Authorization": f"Bearer {user_token}"}
        async with httpx.AsyncClient(timeout=8.0) as client:
            for doc_id in document_ids[:8]:
                if used >= TEXT_CHAR_BUDGET:
                    break
                try:
                    resp = await client.get(
                        f"{self._base}/api/v1/documents/{doc_id}/text",
                        headers=headers,
                    )
                    if resp.status_code != 200:
                        continue
                    body = resp.json()
                    title = body.get("title") or body.get("filename") or doc_id
                    text = (body.get("text") or "").strip()
                    if not text:
                        continue
                    remain = TEXT_CHAR_BUDGET - used
                    excerpt = text[:remain]
                    parts.append(f"### {title}\n{excerpt}")
                    used += len(excerpt)
                except Exception as exc:
                    logger.warning("document_text_fetch_failed document_id=%s error=%s", doc_id, exc)
        if not parts:
            return ""
        return (
            "USER-UPLOADED DOCUMENTS (treat as evidence supplied by the user; "
            "cite them as the user's file, not as [KB] statutes):\n\n" + "\n\n".join(parts)
        )
