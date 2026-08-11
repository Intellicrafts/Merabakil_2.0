"""Ports the orchestrator depends on (implemented by the hosting service)."""

from __future__ import annotations

from typing import Any, Protocol

from legalos_common.clients.llm import ChatMessage
from legalos_common.rag.filters import SearchFilters
from legalos_common.rag.schemas import RetrievedSource


class RetrieverPort(Protocol):
    async def retrieve(
        self,
        query: str,
        *,
        top_k: int,
        filters: SearchFilters | None,
        user_token: str | None,
    ) -> list[RetrievedSource]: ...


class LLMPort(Protocol):
    async def complete(self, messages: list[ChatMessage], *, temperature: float = 0.1) -> str: ...

    def stream_complete(
        self, messages: list[ChatMessage], *, temperature: float = 0.1
    ): ...


class SpecialistPort(Protocol):
    async def analyze(
        self,
        *,
        query: str,
        facts: str | None,
        document_id: str | None,
        user_token: str | None,
    ) -> dict[str, Any]: ...
