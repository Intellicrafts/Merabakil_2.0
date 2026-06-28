from __future__ import annotations

from legalos_orchestrator.conversation import (
    build_chat_messages,
    expand_retrieval_query,
    needs_history_for_retrieval,
)
from legalos_orchestrator.schemas import ConversationMessage


def test_expand_retrieval_query_keeps_standalone_question() -> None:
    history = [
        ConversationMessage(role="user", content="What is Article 21?"),
        ConversationMessage(role="assistant", content="Article 21 protects life and liberty."),
    ]
    query = "What are the fundamental duties listed in the Constitution of India?"
    assert expand_retrieval_query(query, history) == query


def test_expand_retrieval_query_enriches_follow_up() -> None:
    history = [
        ConversationMessage(role="user", content="What is Article 21?"),
        ConversationMessage(role="assistant", content="Article 21 protects life and liberty."),
    ]
    query = "Explain that further"
    expanded = expand_retrieval_query(query, history)
    assert "Article 21" in expanded
    assert "Explain that further" in expanded


def test_build_chat_messages_includes_history() -> None:
    history = [
        ConversationMessage(role="user", content="What is Article 21?"),
        ConversationMessage(role="assistant", content="Article 21 protects life and liberty."),
    ]
    messages = build_chat_messages("system", history, "Tell me more")
    assert messages[0].role == "system"
    assert messages[1].content == "What is Article 21?"
    assert messages[-1].content == "Tell me more"


def test_needs_history_for_retrieval_short_follow_up() -> None:
    history = [ConversationMessage(role="user", content="Article 21")]
    assert needs_history_for_retrieval("tell me more", history) is True
    assert needs_history_for_retrieval("What are the fundamental duties in India?", history) is False
