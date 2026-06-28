"""Text normalisation/cleaning for legal documents."""

from __future__ import annotations

import re

_MULTISPACE = re.compile(r"[ \t]+")
_MULTINEWLINE = re.compile(r"\n{3,}")
_PAGE_NUMBER = re.compile(r"^\s*(?:page\s*)?\d+\s*(?:of\s*\d+)?\s*$", re.IGNORECASE | re.MULTILINE)
_HYPHEN_LINEBREAK = re.compile(r"(\w)-\n(\w)")


def clean_text(text: str) -> str:
    if not text:
        return ""
    # Repair words split across line breaks by hyphenation.
    text = _HYPHEN_LINEBREAK.sub(r"\1\2", text)
    # Drop standalone page-number lines (common PDF footer noise).
    text = _PAGE_NUMBER.sub("", text)
    # Normalise whitespace.
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _MULTISPACE.sub(" ", text)
    text = _MULTINEWLINE.sub("\n\n", text)
    return text.strip()
