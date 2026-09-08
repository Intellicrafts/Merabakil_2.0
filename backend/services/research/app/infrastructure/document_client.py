"""Fetch extracted text for user-uploaded documents."""

from __future__ import annotations

import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

TEXT_CHAR_BUDGET = 24_000


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
                return None
            body = resp.json()
            title = body.get("title") or body.get("filename") or doc_id
            text = (body.get("text") or "").strip()
            return (title, text) if text else None
        except Exception as exc:
            logger.warning("document_text_fetch_failed document_id=%s error=%s", doc_id, exc)
            return None

    async def fetch_excerpts(
        self,
        document_ids: list[str],
        *,
        user_token: str | None,
    ) -> str:
        if not document_ids or not user_token:
            return ""
        headers = {"Authorization": f"Bearer {user_token}"}
        # Fetch all docs in parallel — previously sequential with 8s timeout each
        async with httpx.AsyncClient(timeout=5.0) as client:
            results = await asyncio.gather(
                *[self._fetch_one(client, doc_id, headers) for doc_id in document_ids[:8]],
                return_exceptions=True,
            )

        parts: list[str] = []
        used = 0
        for result in results:
            if used >= TEXT_CHAR_BUDGET:
                break
            if not result or isinstance(result, Exception):
                continue
            title, text = result
            remain = TEXT_CHAR_BUDGET - used
            excerpt = text[:remain]
            parts.append(f"### {title}\n{excerpt}")
            used += len(excerpt)

        if not parts:
            return ""
        return (
            "USER-UPLOADED DOCUMENTS (treat as evidence supplied by the user; "
            "cite them as the user's file, not as [KB] statutes):\n\n" + "\n\n".join(parts)
        )
