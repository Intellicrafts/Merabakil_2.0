"""Does the name on a Bar Council record belong to the person claiming it?

Lenient where Indian names legitimately vary — titles, initials ("R K Sharma"),
word order ("Kaur Harpreet"), joined names ("Mohanlal"), small spelling
differences ("Chandra"/"Chander") — but a different person's name never
matches. Anything that does not match goes to an admin, never straight to
rejection.
"""

from __future__ import annotations

import re
from difflib import SequenceMatcher

_TITLES = {
    "ADV", "ADVOCATE", "DR", "MR", "MRS", "MS", "MISS", "SHRI", "SH", "SRI", "SMT", "KM",
    "KUMARI", "LATE", "SR", "JR", "PROF", "ER",
}
_ALIASES = {"MOHD": "MOHAMMAD", "MD": "MOHAMMAD", "MOHAMMED": "MOHAMMAD", "MUHAMMAD": "MOHAMMAD"}
_RELATION = re.compile(r"\b(?:S/O|D/O|W/O|C/O|SON OF|DAUGHTER OF|WIFE OF)\b.*$")


def name_tokens(name: str | None) -> list[str]:
    s = _RELATION.sub("", (name or "").upper())
    s = re.sub(r"[^A-Z\s]", " ", s)
    return [_ALIASES.get(t, t) for t in s.split() if t not in _TITLES]


def _compatible(a: str, b: str) -> bool:
    if a == b:
        return True
    if len(a) == 1 or len(b) == 1:  # an initial matches the word it stands for
        return a[0] == b[0]
    return len(a) > 2 and len(b) > 2 and SequenceMatcher(None, a, b).ratio() >= 0.85


def names_match(profile_name: str | None, record_name: str | None) -> bool:
    a, b = name_tokens(profile_name), name_tokens(record_name)
    if not a or not b:
        return False
    if "".join(a) == "".join(b) or "".join(sorted(a)) == "".join(sorted(b)):
        return True
    short, long = (a, b) if len(a) <= len(b) else (b, a)
    # Full words first, so an initial can't take a word another full word needs.
    unused = list(long)
    full_word_pairs = 0
    for token in sorted(short, key=len, reverse=True):
        match = next((u for u in unused if _compatible(token, u)), None)
        if match is None:
            return False
        unused.remove(match)
        if len(token) > 1 and len(match) > 1:
            full_word_pairs += 1
    return full_word_pairs >= 1  # initials alone ("A K") never prove a name
