"""RAG security: prompt-injection detection and input sanitisation.

These controls operate on *user* input and on *retrieved* content (indirect
prompt injection), reducing the risk that adversarial text overrides system
instructions.
"""

from __future__ import annotations

import re

from pydantic import BaseModel

_INJECTION_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"ignore (?:all |the |your )?(?:previous|prior|above) (?:instructions|prompts)",
        r"disregard (?:all |the |your )?(?:previous|prior|above)",
        r"you are now (?:a|an|the)\b",
        r"system prompt",
        r"developer message",
        r"reveal (?:your )?(?:system )?prompt",
        r"act as (?:a|an)\b.*(?:dan|jailbreak)",
        r"</?(?:system|assistant|user)>",
        r"\bBEGIN\s+SYSTEM\b",
    )
)

_MAX_INPUT_CHARS = 8_000


class PromptInjectionResult(BaseModel):
    is_suspicious: bool
    matched_patterns: list[str]


def detect_prompt_injection(text: str) -> PromptInjectionResult:
    matches = [p.pattern for p in _INJECTION_PATTERNS if p.search(text)]
    return PromptInjectionResult(is_suspicious=bool(matches), matched_patterns=matches)


def sanitize_user_input(text: str) -> str:
    """Trim, cap length, and neutralise role-tag injection in user input."""
    cleaned = text.strip()[:_MAX_INPUT_CHARS]
    cleaned = re.sub(r"</?(?:system|assistant|user|tool)>", "", cleaned, flags=re.IGNORECASE)
    return cleaned
