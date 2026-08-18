"""Shared memory schemas used by session and long-term memory layers."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SessionTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    cited_chunk_ids: list[str] = Field(default_factory=list)


class MemoryContext(BaseModel):
    session_history: list[SessionTurn] = Field(default_factory=list)
    long_term_facts: list[str] = Field(default_factory=list)
