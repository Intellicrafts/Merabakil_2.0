"""Deterministic emergency detection — guarantees helplines lead the reply.

The system prompt also carries an EMERGENCY OVERRIDE, but a person in danger must
not depend on the model remembering it. Patterns target first-person, present
danger so routine legal questions ("punishment for murder") do not trigger.
"""

from __future__ import annotations

import re

_DEVANAGARI = re.compile(r"[ऀ-ॿ]")

_PATTERNS = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        # self-harm (EN / Hinglish / Hindi)
        r"\b(kill|hurt|harm)\s+my\s*self\b",
        r"\bsuicid(e|al)\b",
        r"\bend\s+(my|this)\s+life\b",
        r"\bwant\s+to\s+die\b",
        r"\bdon'?t\s+want\s+to\s+live\b",
        r"\bmarna\s+chaht[aie]\b",
        r"\bjeena\s+nahi\s+chaht[aie]\b",
        r"आत्महत्या",
        r"मरना\s+चाहत[ाीे]",
        r"जीना\s+नहीं\s+चाहत[ाीे]",
        # violence / threats happening to the user now
        r"\b(beat|beats|beating|hits|hitting|slaps|choked|strangl\w*)\s+me\b",
        r"\b(is|are|keeps)\s+(beating|hitting|abusing|threatening)\s+me\b",
        r"\bthreaten\w*\s+to\s+kill\s+me\b",
        r"\b(going|trying)\s+to\s+kill\s+me\b",
        r"\bjaan\s+se\s+maar\w*\b",
        r"\bmaar\s*(ta|te|ti)\s+h(ai|ain|u)\b",
        r"\bmaar\s*peet\b",
        r"जान\s+से\s+मार",
        r"मारपीट",
        r"(पीटता|पीटती|पीटते|मारता|मारती|मारते)\s+है",
        # sexual violence / captivity / children at risk
        r"\b(i\s+was|i've\s+been|i\s+got|was\s+i)\s+(raped|sexually\s+assaulted|molested)\b",
        r"\braped\s+me\b",
        r"बलात्कार",
        r"\b(locked|trapped|held)\s+me\b",
        r"\bkidnapp\w*\b",
        r"\b(abusing|beating|hurting)\s+(my|our)\s+(child|children|son|daughter|kid)\b",
    )
)

_HELPLINES_EN = (
    "**If you are in danger right now, please get help immediately:**\n"
    "- Emergency (police / ambulance): **112**\n"
    "- Women helpline: **181**\n"
    "- Child helpline: **1098**\n"
    "- Tele-MANAS mental health support (24x7, free): **14416**\n"
    "- Free legal aid (NALSA): **15100**\n\n"
)

_HELPLINES_HI = (
    "**अगर आप अभी खतरे में हैं, तो कृपया तुरंत मदद लें:**\n"
    "- आपातकाल (पुलिस / एम्बुलेंस): **112**\n"
    "- महिला हेल्पलाइन: **181**\n"
    "- चाइल्ड हेल्पलाइन: **1098**\n"
    "- टेली-मानस मानसिक स्वास्थ्य सहायता (24x7, निःशुल्क): **14416**\n"
    "- निःशुल्क कानूनी सहायता (NALSA): **15100**\n\n"
)


def is_emergency(text: str) -> bool:
    return any(p.search(text) for p in _PATTERNS)


def helpline_preface(text: str) -> str:
    return _HELPLINES_HI if _DEVANAGARI.search(text) else _HELPLINES_EN
