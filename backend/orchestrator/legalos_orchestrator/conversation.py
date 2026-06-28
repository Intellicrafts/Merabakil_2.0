"""Helpers for multi-turn chat memory in the orchestrator."""

from __future__ import annotations

import re

from legalos_common.clients.llm import ChatMessage
from legalos_orchestrator.schemas import ConversationMessage

_MAX_HISTORY_TURNS = 20
_MAX_SNIPPET_CHARS = 500

_FOLLOW_UP_RE = re.compile(
    r"\b(?:that|this|it|those|these|them|above|earlier|before|same|more|further|"
    r"elaborate|also|continue|again)\b|"
    r"explain\s+(?:it|that|this)|what\s+about|how\s+about|tell\s+me\s+more|"
    r"go\s+on|and\s+(?:what|how|why)",
    re.IGNORECASE,
)

_CONVERSATIONAL_RE = re.compile(
    r"^\s*(hi+|hey+|hello+|hlo|yo+|sup|namaste|namaskar|salaam|"
    r"good\s*(morning|afternoon|evening|night)|"
    r"thanks?|thank\s*you|thanku|thnx|thx|ty|"
    r"ok(ay)?|okk+|k|cool|nice|great|awesome|got\s*it|"
    r"bye+|goodbye|see\s*you|see\s*ya)[\s!.,?]*$",
    re.IGNORECASE,
)

_META_RE = re.compile(
    r"(who\s+(are|r)\s+(you|u)\b|what\s+(are|r)\s+(you|u)\b|"
    r"what'?s?\s+your\s+name|your\s+name\b|"
    r"who\s+(built|made|created|developed|designed)\s+(you|u|this)\b|"
    r"who\s+is\s+your\s+(maker|creator|developer|owner)|"
    r"what\s+can\s+(you|u)\s+do\b|what\s+(do|can)\s+(you|u)\s+help\b|"
    r"how\s+(can|do)\s+(you|u)\s+help\b|"
    r"introduce\s+yourself|tell\s+me\s+about\s+(yourself|you)\b|"
    r"are\s+you\s+(an?\s+)?(ai|bot|robot|human|real))",
    re.IGNORECASE,
)


def is_conversational(query: str) -> bool:
    text = query.strip()
    if not text:
        return True
    if _CONVERSATIONAL_RE.match(text):
        return True
    return bool(_META_RE.search(text))


def recent_history(
    history: list[ConversationMessage],
    *,
    max_turns: int = _MAX_HISTORY_TURNS,
) -> list[ConversationMessage]:
    return history[-max_turns:]


def history_to_chat_messages(history: list[ConversationMessage]) -> list[ChatMessage]:
    return [
        ChatMessage(role=turn.role, content=turn.content)
        for turn in recent_history(history)
    ]


def build_chat_messages(
    system_prompt: str,
    history: list[ConversationMessage],
    query: str,
) -> list[ChatMessage]:
    messages = [ChatMessage(role="system", content=system_prompt)]
    messages.extend(history_to_chat_messages(history))
    messages.append(ChatMessage(role="user", content=query))
    return messages


def needs_history_for_retrieval(query: str, history: list[ConversationMessage]) -> bool:
    if not history:
        return False
    text = query.strip()
    word_count = len(text.split())
    if word_count <= 6:
        return True
    if _FOLLOW_UP_RE.search(text):
        return True
    return word_count < 12 and text.endswith("?")


def expand_retrieval_query(query: str, history: list[ConversationMessage]) -> str:
    """Blend recent chat turns into the retrieval query for follow-up questions."""
    if not history or not needs_history_for_retrieval(query, history):
        return query

    recent = recent_history(history, max_turns=6)
    lines: list[str] = []
    for turn in recent:
        snippet = turn.content.strip().replace("\n", " ")[:_MAX_SNIPPET_CHARS]
        lines.append(f"{turn.role}: {snippet}")
    lines.append(f"user: {query.strip()}")
    return "\n".join(lines)
