"""Lightweight web search for legal fallback when the corpus is insufficient."""

from __future__ import annotations

import html
import re
from urllib.parse import quote, unquote

import httpx

from legalos_common.rag.schemas import WebImageResult, WebSearchResult

_USER_AGENT = (
    "Mozilla/5.0 (compatible; LegalOS/1.0; +https://legalos.local) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_RESULT_LINK_RE = re.compile(
    r'class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_SNIPPET_RE = re.compile(
    r'class="result__snippet"[^>]*>(.*?)</(?:a|td|div)>',
    re.IGNORECASE | re.DOTALL,
)
_TAG_RE = re.compile(r"<[^>]+>")


def _clean_html(text: str) -> str:
    return html.unescape(_TAG_RE.sub("", text)).strip()


def _normalize_ddg_url(raw: str) -> str:
    if raw.startswith("//"):
        return f"https:{raw}"
    if "uddg=" in raw:
        match = re.search(r"uddg=([^&]+)", raw)
        if match:
            return unquote(match.group(1))
    return raw


async def search_web_text(query: str, *, max_results: int = 5) -> list[WebSearchResult]:
    """Search the public web via DuckDuckGo HTML (no API key required)."""
    results: list[WebSearchResult] = []
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            resp = await client.post(
                "https://html.duckduckgo.com/html/",
                data={"q": query, "kl": "in-en"},
                headers={"User-Agent": _USER_AGENT},
            )
            resp.raise_for_status()
            body = resp.text

        links = _RESULT_LINK_RE.findall(body)
        snippets = _SNIPPET_RE.findall(body)
        for idx, (url, title_html) in enumerate(links[:max_results]):
            snippet = _clean_html(snippets[idx]) if idx < len(snippets) else ""
            results.append(
                WebSearchResult(
                    title=_clean_html(title_html) or query,
                    url=_normalize_ddg_url(url),
                    snippet=snippet,
                )
            )
    except Exception:
        return results

    if results:
        return results

    # Instant-answer API fallback (smaller but reliable)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1, "skip_disambig": 1},
                headers={"User-Agent": _USER_AGENT},
            )
            resp.raise_for_status()
            data = resp.json()
        if data.get("AbstractText"):
            results.append(
                WebSearchResult(
                    title=data.get("Heading") or query,
                    url=data.get("AbstractURL") or "https://duckduckgo.com",
                    snippet=data["AbstractText"],
                )
            )
        for topic in data.get("RelatedTopics", [])[: max_results - len(results)]:
            if isinstance(topic, dict) and topic.get("Text"):
                results.append(
                    WebSearchResult(
                        title=topic["Text"][:120],
                        url=topic.get("FirstURL") or "https://duckduckgo.com",
                        snippet=topic["Text"],
                    )
                )
    except Exception:
        pass

    return results[:max_results]


async def search_web_images(query: str, *, max_results: int = 3) -> list[WebImageResult]:
    """Fetch illustrative images from Wikipedia when relevant."""
    images: list[WebImageResult] = []
    candidates = [
        query.strip(),
        f"{query.strip()} India",
        query.strip().replace("?", ""),
    ]
    seen: set[str] = set()

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        for candidate in candidates:
            if len(images) >= max_results:
                break
            title = quote(candidate.replace(" ", "_")[:120])
            try:
                resp = await client.get(
                    f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}",
                    headers={"User-Agent": _USER_AGENT},
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
                thumb = data.get("thumbnail") or {}
                image_url = thumb.get("source")
                if not image_url or image_url in seen:
                    continue
                seen.add(image_url)
                images.append(
                    WebImageResult(
                        title=data.get("title") or candidate,
                        image_url=image_url,
                        source_url=data.get("content_urls", {})
                        .get("desktop", {})
                        .get("page", f"https://en.wikipedia.org/wiki/{title}"),
                        caption=(data.get("description") or data.get("extract", ""))[:280],
                    )
                )
            except Exception:
                continue

    return images[:max_results]
