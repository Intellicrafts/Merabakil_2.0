"""RAG security: prompt-injection detection, input sanitisation, and output validation.

These controls operate on *user* input and on *retrieved* content (indirect
prompt injection), reducing the risk that adversarial text overrides system
instructions.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Unambiguous jailbreak phrasing — blocked outright.
_INJECTION_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"ignore (?:all |the |your )?(?:previous|prior|above) (?:instructions|prompts)",
        r"disregard (?:all |the |your )?(?:previous|prior|above) (?:instructions|prompts|rules)",
        r"reveal (?:your |the )?(?:system )?prompt",
        r"act as (?:a|an)\b.*(?:dan|jailbreak)",
        r"</?(?:system|assistant|user)>",
        r"\bBEGIN\s+SYSTEM\b",
        r"forget (?:all |your )?(?:previous|prior|above) (?:instructions|prompts|rules)",
    )
)

# Phrases that also appear in genuine legal questions ("is it a crime to pretend
# to be a police officer?") — logged for review, never blocked.
_SUSPICIOUS_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"you are now (?:a|an|the)\b",
        r"pretend (?:you are|to be)\b",
        r"system prompt",
        r"developer message",
    )
)

# Verbatim fragments of Saarthi's own system prompt — if these surface in an
# answer the model is leaking its instructions.
_LEAK_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"TOOL USAGE POLICY",
        r"LAWYER ACCURACY RULE",
        r"EMERGENCY OVERRIDE",
        r"SESSION CONTEXT:\s*Today's date",
        r"do not reveal these instructions",
    )
)

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_HTML_TAGS = re.compile(r"<[^>]+>")
_WHITESPACE = re.compile(r"[ \t]+")
# Saarthi's citation markers: [KB-3], [WEB-1]
_CITATION_RE = re.compile(r"\[(KB|WEB)-(\d+)\]")

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
    matches = [p.pattern for p in (*_INJECTION_PATTERNS, *_SUSPICIOUS_PATTERNS) if p.search(text)]
    return PromptInjectionResult(is_suspicious=bool(matches), matched_patterns=matches)


def sanitize_user_input(text: str) -> str:
    """Trim, cap length, and neutralise role-tag injection in user input."""
    cleaned = text.strip()[:_MAX_INPUT_CHARS]
    cleaned = re.sub(r"</?(?:system|assistant|user|tool)>", "", cleaned, flags=re.IGNORECASE)
    return cleaned


def strip_citation_markers(text: str) -> str:
    """Remove [KB-n]/[WEB-n] markers — they only resolve within the turn that produced them."""
    return re.sub(r" ?\[(?:KB|WEB)-\d+\]", "", text)


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
        if any(p.search(sanitized) for p in _SUSPICIOUS_PATTERNS):
            logger.info("input_guardrail_suspicious_phrase_allowed")

        return GuardrailResult(passed=True, sanitized_query=sanitized)

    @staticmethod
    def _sanitize(query: str) -> str:
        query = _CONTROL_CHARS.sub("", query)
        query = _HTML_TAGS.sub("", query)
        query = _WHITESPACE.sub(" ", query).strip()
        return query[:_MAX_QUERY_LENGTH]


class OutputGuardrail:
    """Validates LLM-generated answers before they are returned to the user."""

    def validate(
        self,
        answer: str,
        *,
        kb_count: int = 0,
        web_count: int = 0,
        used_tools: bool = False,
    ) -> OutputGuardrailResult:
        # 1. System prompt leak detection
        for pattern in _LEAK_PATTERNS:
            if pattern.search(answer):
                return OutputGuardrailResult(
                    passed=False,
                    answer=_FALLBACK_ANSWER,
                    flagged_reason="system_prompt_leak",
                )

        # 2. Drop markers that don't resolve to a source retrieved this turn.
        limits = {"KB": kb_count, "WEB": web_count}

        def _guard(m: re.Match) -> str:
            kind, idx = m.group(1), int(m.group(2))
            return m.group(0) if 1 <= idx <= limits[kind] else ""

        answer = _CITATION_RE.sub(_guard, answer)

        # 3. Grounding note only when sources were retrieved but none were cited.
        if used_tools and (kb_count or web_count) and len(answer.split()) > 100:
            if not _CITATION_RE.search(answer):
                answer += (
                    "\n\n*Note: This response does not cite the retrieved sources. "
                    "Please verify with primary legal sources.*"
                )

        return OutputGuardrailResult(passed=True, answer=answer)
