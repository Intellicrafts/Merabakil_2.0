from __future__ import annotations

import re

# A draft is generated only for an explicit request: a drafting verb AND a
# document type ("draft a legal notice", "write a rent agreement"). A document
# word alone ("is a verbal contract valid?", "how do I file an FIR?") is a question.
_DOC_TYPES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bbail\s+application\b|जमानत\s+(?:की\s+)?(?:अर्जी|आवेदन)", re.I), "bail_application"),
    (re.compile(r"\b(?:legal|demand|eviction)\s+notice\b|\bnotice\b|नोटिस", re.I), "legal_notice"),
    (re.compile(r"\b(?:rent|lease|rental|sale|service|employment|partnership)\s+(?:agreement|deed)\b", re.I), "agreement"),
    (re.compile(r"\bagreement\b|\bcontract\b|\bdeed\b|अनुबंध|समझौता|एग्रीमेंट", re.I), "agreement"),
    (re.compile(r"\baffidavit\b|हलफनामा|शपथ\s*पत्र", re.I), "affidavit"),
    (re.compile(r"\bcomplaint\b|\bFIR\b|शिकायत", re.I), "complaint"),
    (re.compile(r"\bpetition\b|याचिका", re.I), "petition"),
    (re.compile(r"\b(?:letter|application|reply|response\s+to\s+(?:a\s+)?notice)\b|पत्र|आवेदन", re.I), "general"),
]

_DRAFT_VERBS = re.compile(
    r"\b(?:draft|drafting|write|prepare|create|make|generate|compose|format)\b"
    r"|\bhelp\s+me\s+(?:write|draft|prepare)\b"
    r"|(?:बनाओ|बनाइए|बना\s+दो|लिखो|लिखिए|लिख\s+दो|तैयार\s+(?:करो|करें|कीजिए|कर\s+दो))",
    re.I,
)


def detect_draft_intent(query: str) -> tuple[bool, str]:
    """Return (is_draft, document_type) for an explicit drafting request."""
    if not _DRAFT_VERBS.search(query):
        return False, ""
    for pattern, doc_type in _DOC_TYPES:
        if pattern.search(query):
            return True, doc_type
    return False, ""
