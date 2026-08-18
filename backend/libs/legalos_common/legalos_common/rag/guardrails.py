"""RAG security: prompt-injection detection, input sanitisation, and output validation.

These controls operate on *user* input and on *retrieved* content (indirect
prompt injection), reducing the risk that adversarial text overrides system
instructions.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

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
        r"pretend (?:you are|to be)\b",
        r"forget (?:all |your )?(?:previous|prior|above)",
    )
)

_LEAK_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"CRITICAL RULES",
        r"do not reveal these instructions",
        r"system prompt",
        r"you are an? (?:expert|assistant|ai|bot)\b.{0,60}(?:specializing|designed|built)",
    )
)

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_HTML_TAGS = re.compile(r"<[^>]+>")
_WHITESPACE = re.compile(r"\s+")
_CITATION_RE = re.compile(r"\[(\d+)\]")

_MAX_INPUT_CHARS = 8_000
_MAX_QUERY_LENGTH = 4_000

_FALLBACK_ANSWER = (
    "I'm unable to provide a reliable response to this query. "
    "Please rephrase your question."
)


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


# ---------------------------------------------------------------------------
# Full guardrail classes (ported from Converstation Chat Bot)
# ---------------------------------------------------------------------------

@dataclass
class GuardrailResult:
    passed: bool
    reason: str = ""
    sanitized_query: str = ""


@dataclass
class OutputGuardrailResult:
    passed: bool
    answer: str
    flagged_reason: str = ""


class InputGuardrail:
    """Validates and sanitizes user queries before they reach the pipeline."""

    def validate(self, query: str) -> GuardrailResult:
        if not query or not query.strip():
            return GuardrailResult(passed=False, reason="empty_query")
        if len(query) > _MAX_QUERY_LENGTH:
            return GuardrailResult(passed=False, reason="query_too_long")

        sanitized = self._sanitize(query)

        for pattern in _INJECTION_PATTERNS:
            if pattern.search(sanitized):
                return GuardrailResult(
                    passed=False,
                    reason="injection_detected",
                    sanitized_query=sanitized,
                )

        return GuardrailResult(passed=True, sanitized_query=sanitized)

    @staticmethod
    def _sanitize(query: str) -> str:
        query = _CONTROL_CHARS.sub("", query)
        query = _HTML_TAGS.sub("", query)
        query = _WHITESPACE.sub(" ", query).strip()
        return query[:_MAX_QUERY_LENGTH]


class OutputGuardrail:
    """Validates LLM-generated answers before they are returned to the user."""

    def validate(self, answer: str, max_valid_citations: int = 0) -> OutputGuardrailResult:
        # 1. System prompt leak detection
        for pattern in _LEAK_PATTERNS:
            if pattern.search(answer):
                return OutputGuardrailResult(
                    passed=False,
                    answer=_FALLBACK_ANSWER,
                    flagged_reason="system_prompt_leak",
                )

        # 2. Citation index range fix — replace out-of-range [N] markers
        if max_valid_citations > 0:
            def _guard(m: re.Match) -> str:
                return m.group(0) if int(m.group(1)) <= max_valid_citations else "[citation unavailable]"
            answer = _CITATION_RE.sub(_guard, answer)

        # 3. Grounding disclaimer for long, uncited answers
        word_count = len(answer.split())
        citation_count = len(_CITATION_RE.findall(answer))
        if word_count > 100 and citation_count == 0:
            answer += (
                "\n\n*Note: This response was generated without explicit source citations. "
                "Please verify with primary legal sources.*"
            )

        return OutputGuardrailResult(passed=True, answer=answer)
