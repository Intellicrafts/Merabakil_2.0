"""Legal metadata + citation extraction (Indian legal citation conventions)."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Indian reporter / citation patterns.
_CITATION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"AIR\s+\d{4}\s+[A-Z]{2,4}\s+\d+"),                 # AIR 1973 SC 1461
    re.compile(r"\(\d{4}\)\s+\d+\s+SCC\s+\d+"),                    # (1997) 6 SCC 241
    re.compile(r"\d{4}\s+SCC\s+OnLine\s+[A-Z]{2,4}\s+\d+"),        # 2020 SCC OnLine SC 123
    re.compile(r"\(\d{4}\)\s+\d+\s+[A-Z]{2,4}\s+\d+"),             # generic reporter
)
_SECTION_PATTERN = re.compile(r"[Ss]ection\s+(\d+[A-Za-z\-]*)")
_ARTICLE_PATTERN = re.compile(r"[Aa]rticle\s+(\d+[A-Za-z\-]*)")
_ACT_PATTERN = re.compile(r"([A-Z][A-Za-z&\.\s]+Act,?\s+\d{4})")

_JURISDICTION_HINTS = {
    "supreme court": "supreme_court",
    "high court": "high_court",
    "tribunal": "tribunal",
    "constitution of india": "constitution",
}


@dataclass(slots=True)
class ExtractedMetadata:
    citations: list[str] = field(default_factory=list)
    sections: list[str] = field(default_factory=list)
    articles: list[str] = field(default_factory=list)
    acts: list[str] = field(default_factory=list)
    detected_jurisdiction: str | None = None


def _dedupe_preserve(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        norm = re.sub(r"\s+", " ", item.strip())
        if norm and norm.lower() not in seen:
            seen.add(norm.lower())
            out.append(norm)
    return out


def extract_metadata(text: str) -> ExtractedMetadata:
    citations: list[str] = []
    for pat in _CITATION_PATTERNS:
        citations.extend(pat.findall(text))

    sections = _SECTION_PATTERN.findall(text)
    articles = _ARTICLE_PATTERN.findall(text)
    acts = _ACT_PATTERN.findall(text)

    detected = None
    lowered = text.lower()
    for hint, value in _JURISDICTION_HINTS.items():
        if hint in lowered:
            detected = value
            break

    return ExtractedMetadata(
        citations=_dedupe_preserve(citations),
        sections=_dedupe_preserve(sections),
        articles=_dedupe_preserve(articles),
        acts=_dedupe_preserve(acts),
        detected_jurisdiction=detected,
    )
