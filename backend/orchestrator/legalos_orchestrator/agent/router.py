"""LLM-based query router — classifies intent before expensive pipeline steps."""

from __future__ import annotations

import logging
import re
from enum import StrEnum

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)


class QueryRoute(StrEnum):
    CONVERSATIONAL = "conversational"
    LEGAL = "legal"


_SYSTEM = (
    "You are a query classifier for Mera Vakil, an Indian legal AI assistant.\n\n"
    "Classify the user query into exactly one category and reply with that single word only.\n\n"
    "conversational — greetings, small talk, 'how are you', 'who are you', "
    "'what can you do', 'thanks', 'bye', 'namaste', 'kya hal hai', chitchat, "
    "questions about the assistant itself.\n\n"
    "legal — any question about Indian law, legal rights, court cases, statutes, "
    "procedures, FIR, bail, divorce, property, contracts, constitutional rights, "
    "judgments, legal documents, or anything requiring legal knowledge or research.\n\n"
    "Reply with exactly one word: conversational OR legal. Nothing else."
)

_CONVERSATIONAL_RE = re.compile(
    r"^\s*(hi+|hello|hey|how are you|what can you (do|help)|who are you|"
    r"namaskar|namaste|thanks?|thank you|bye|good\s*(morning|evening|night)|"
    r"what is mera vakil|tell me about yourself)\W*$",
    re.IGNORECASE,
)


class QueryRouter:
    """Fast LLM router — returns a QueryRoute enum value for every query."""

    def __init__(self, *, model: str, api_key: str) -> None:
        self._llm = ChatGoogleGenerativeAI(
            model=model,
            google_api_key=api_key,
            temperature=0.0,
            max_output_tokens=10,
        )

    def _quick_classify(self, query: str) -> QueryRoute | None:
        q = query.strip()
        if _CONVERSATIONAL_RE.match(q):
            return QueryRoute.CONVERSATIONAL
        if len(q) > 60:
            return QueryRoute.LEGAL
        return None

    async def classify(self, query: str) -> QueryRoute:
        quick = self._quick_classify(query)
        if quick is not None:
            return quick
        try:
            result = await self._llm.ainvoke([
                SystemMessage(content=_SYSTEM),
                HumanMessage(content=query),
            ])
            # result.content can be a list of parts on Gemini — flatten to string
            content = result.content
            if isinstance(content, list):
                text = " ".join(
                    p.get("text", "") if isinstance(p, dict) else str(p)
                    for p in content
                ).strip().lower()
            else:
                text = (content or "").strip().lower()
            words = text.split()
            first_word = words[0] if words else ""
            if first_word == QueryRoute.CONVERSATIONAL:
                return QueryRoute.CONVERSATIONAL
            return QueryRoute.LEGAL
        except Exception as exc:
            logger.warning("router_classify_failed error=%s — defaulting to legal", exc)
            return QueryRoute.LEGAL
