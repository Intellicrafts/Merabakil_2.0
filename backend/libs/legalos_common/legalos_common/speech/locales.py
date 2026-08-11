"""Indian regional speech locales for read-aloud."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SpeechLocale:
    code: str
    label: str
    bcp47: str
    voice: str
    rewrite_prompt: str


_DEFAULT_REWRITE_SUFFIX = (
    "Remove markdown, citations, and disclaimers. Keep key legal points accurate. "
    "Output plain speech text only — no headings or bullet markers."
)

INDIAN_SPEECH_LOCALES: dict[str, SpeechLocale] = {
    "en-IN": SpeechLocale(
        code="en-IN",
        label="English (Indian)",
        bcp47="en-IN",
        voice="Kore",
        rewrite_prompt=(
            "Rewrite the following legal answer for natural spoken delivery in warm, "
            "professional Indian English — the tone of a knowledgeable Indian advocate "
            "explaining clearly to a client. Use natural Indian phrasing where appropriate. "
            + _DEFAULT_REWRITE_SUFFIX
        ),
    ),
    "hi-IN": SpeechLocale(
        code="hi-IN",
        label="Hindi",
        bcp47="hi-IN",
        voice="Kore",
        rewrite_prompt=(
            "Rewrite the following legal answer entirely in Hindi (Devanagari script) for "
            "spoken delivery. Use respectful, clear Indian legal vocabulary (e.g. संविधान, "
            "धारा, अधिकार). Sound like a trusted Indian vakil explaining to a client. "
            + _DEFAULT_REWRITE_SUFFIX
        ),
    ),
    "ta-IN": SpeechLocale(
        code="ta-IN",
        label="Tamil",
        bcp47="ta-IN",
        voice="Kore",
        rewrite_prompt=(
            "Rewrite the following legal answer entirely in Tamil script for spoken delivery. "
            "Use clear Indian legal terminology and a respectful regional advocate tone. "
            + _DEFAULT_REWRITE_SUFFIX
        ),
    ),
    "te-IN": SpeechLocale(
        code="te-IN",
        label="Telugu",
        bcp47="te-IN",
        voice="Kore",
        rewrite_prompt=(
            "Rewrite the following legal answer entirely in Telugu script for spoken delivery. "
            "Use clear Indian legal terminology and a respectful regional advocate tone. "
            + _DEFAULT_REWRITE_SUFFIX
        ),
    ),
    "bn-IN": SpeechLocale(
        code="bn-IN",
        label="Bengali",
        bcp47="bn-IN",
        voice="Kore",
        rewrite_prompt=(
            "Rewrite the following legal answer entirely in Bengali script for spoken delivery. "
            "Use clear Indian legal terminology and a respectful regional advocate tone. "
            + _DEFAULT_REWRITE_SUFFIX
        ),
    ),
    "mr-IN": SpeechLocale(
        code="mr-IN",
        label="Marathi",
        bcp47="mr-IN",
        voice="Kore",
        rewrite_prompt=(
            "Rewrite the following legal answer entirely in Marathi (Devanagari) for spoken "
            "delivery. Use clear Indian legal terminology and a respectful regional advocate tone. "
            + _DEFAULT_REWRITE_SUFFIX
        ),
    ),
    "gu-IN": SpeechLocale(
        code="gu-IN",
        label="Gujarati",
        bcp47="gu-IN",
        voice="Kore",
        rewrite_prompt=(
            "Rewrite the following legal answer entirely in Gujarati script for spoken delivery. "
            "Use clear Indian legal terminology and a respectful regional advocate tone. "
            + _DEFAULT_REWRITE_SUFFIX
        ),
    ),
    "kn-IN": SpeechLocale(
        code="kn-IN",
        label="Kannada",
        bcp47="kn-IN",
        voice="Kore",
        rewrite_prompt=(
            "Rewrite the following legal answer entirely in Kannada script for spoken delivery. "
            "Use clear Indian legal terminology and a respectful regional advocate tone. "
            + _DEFAULT_REWRITE_SUFFIX
        ),
    ),
    "pa-IN": SpeechLocale(
        code="pa-IN",
        label="Punjabi",
        bcp47="pa-IN",
        voice="Kore",
        rewrite_prompt=(
            "Rewrite the following legal answer in Punjabi (Gurmukhi) for spoken delivery. "
            "Use clear Indian legal terminology and a respectful regional advocate tone. "
            + _DEFAULT_REWRITE_SUFFIX
        ),
    ),
}

DEFAULT_SPEECH_LOCALE = "en-IN"


def get_speech_locale(code: str | None) -> SpeechLocale:
    if code and code in INDIAN_SPEECH_LOCALES:
        return INDIAN_SPEECH_LOCALES[code]
    return INDIAN_SPEECH_LOCALES[DEFAULT_SPEECH_LOCALE]
