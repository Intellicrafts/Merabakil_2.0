from __future__ import annotations

import re

_DRAFTING_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bbail\s+application\b", re.I), "bail_application"),
    (re.compile(r"\blegal\s+notice\b", re.I), "legal_notice"),
    (re.compile(r"\bdemand\s+notice\b", re.I), "legal_notice"),
    (re.compile(r"\brent\s+agreement\b", re.I), "agreement"),
    (re.compile(r"\blease\s+agreement\b", re.I), "agreement"),
    (re.compile(r"\bagreement\b", re.I), "agreement"),
    (re.compile(r"\baffidavit\b", re.I), "affidavit"),
    (re.compile(r"\bcomplaint\s+(letter|to|against|with)\b", re.I), "complaint"),
    (re.compile(r"\bFIR\b"), "complaint"),
    (re.compile(r"\bpetition\b", re.I), "petition"),
    (re.compile(r"\bcontract\b", re.I), "agreement"),
]

_TRIGGER_VERBS = re.compile(
    r"\b(draft|write|prepare|create|make|generate|compose|help\s+me\s+(write|draft|prepare))\b",
    re.I,
)


def detect_draft_intent(query: str) -> tuple[bool, str]:
    """Return (is_draft, document_type). Fast keyword/regex classifier."""
    has_trigger = bool(_TRIGGER_VERBS.search(query))
    for pattern, doc_type in _DRAFTING_PATTERNS:
        if pattern.search(query):
            # A document keyword alone is enough (e.g. "legal notice for landlord")
            return True, doc_type
    if has_trigger:
        # Trigger verb without a specific type → generic document
        return True, "general"
    return False, ""
