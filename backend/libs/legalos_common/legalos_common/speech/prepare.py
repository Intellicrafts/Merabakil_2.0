"""NLP-style preprocessing to turn legal markdown answers into natural spoken text."""

from __future__ import annotations

import re

_MAX_SPEECH_CHARS = 4000
_CHUNK_TARGET = 320

_MD_CODE_BLOCK = re.compile(r"```[\s\S]*?```", re.MULTILINE)
_MD_INLINE_CODE = re.compile(r"`([^`]+)`")
_MD_LINK = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_MD_IMAGE = re.compile(r"!\[([^\]]*)\]\([^)]+\)")
_MD_BOLD = re.compile(r"\*\*([^*]+)\*\*")
_MD_ITALIC = re.compile(r"(?<!\*)\*([^*]+)\*(?!\*)")
_MD_HEADER = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_MD_LIST = re.compile(r"^[\s]*[-*+]\s+", re.MULTILINE)
_MD_ORDERED = re.compile(r"^[\s]*\d+\.\s+", re.MULTILINE)
_CITATION = re.compile(r"\[\^?\d+\]")
_DISCLAIMER = re.compile(
    r"(this (response|information) is (not|for) informational|not a substitute for.*advocate|"
    r"consult a qualified|seek professional legal advice)",
    re.IGNORECASE,
)

_LEGAL_EXPANSIONS = (
    (re.compile(r"\bArt\.\s*", re.IGNORECASE), "Article "),
    (re.compile(r"\bSec\.\s*", re.IGNORECASE), "Section "),
    (re.compile(r"\bvs\.\s*", re.IGNORECASE), "versus "),
    (re.compile(r"\bNo\.\s*", re.IGNORECASE), "Number "),
    (re.compile(r"\bIPC\b"), "Indian Penal Code"),
    (re.compile(r"\bCrPC\b"), "Code of Criminal Procedure"),
    (re.compile(r"\bCPC\b"), "Code of Civil Procedure"),
)


def _strip_markdown(text: str) -> str:
    text = _MD_CODE_BLOCK.sub("", text)
    text = _MD_IMAGE.sub(r"\1", text)
    text = _MD_LINK.sub(r"\1", text)
    text = _MD_INLINE_CODE.sub(r"\1", text)
    text = _MD_BOLD.sub(r"\1", text)
    text = _MD_ITALIC.sub(r"\1", text)
    text = _MD_HEADER.sub("", text)
    text = _MD_LIST.sub("", text)
    text = _MD_ORDERED.sub("", text)
    text = _CITATION.sub("", text)
    return text


def _expand_legal_shorthand(text: str) -> str:
    for pattern, replacement in _LEGAL_EXPANSIONS:
        text = pattern.sub(replacement, text)
    return text


def _normalize_whitespace(text: str) -> str:
    text = text.replace("\r\n", "\n")
    lines = [line.strip() for line in text.split("\n")]
    paragraphs: list[str] = []
    buffer: list[str] = []
    for line in lines:
        if not line:
            if buffer:
                paragraphs.append(" ".join(buffer))
                buffer = []
            continue
        if _DISCLAIMER.search(line):
            continue
        buffer.append(line)
    if buffer:
        paragraphs.append(" ".join(buffer))
    joined = " ".join(p for p in paragraphs if p)
    return re.sub(r"\s{2,}", " ", joined).strip()


def prepare_speech_text(markdown: str) -> str:
    """Return a single speakable string capped for TTS latency."""
    text = _strip_markdown(markdown)
    text = _expand_legal_shorthand(text)
    text = _normalize_whitespace(text)
    if len(text) > _MAX_SPEECH_CHARS:
        text = text[:_MAX_SPEECH_CHARS].rsplit(" ", 1)[0] + "."
    return text


def prepare_speech_chunks(markdown: str) -> list[str]:
    """Split speakable text into sentence-sized chunks for streaming TTS."""
    text = prepare_speech_text(markdown)
    if not text:
        return []

    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        candidate = f"{current} {sentence}".strip() if current else sentence
        if len(candidate) <= _CHUNK_TARGET:
            current = candidate
        else:
            if current:
                chunks.append(current)
            current = sentence if len(sentence) <= _CHUNK_TARGET else sentence[:_CHUNK_TARGET]

    if current:
        chunks.append(current)

    return chunks or [text[:_CHUNK_TARGET]]
