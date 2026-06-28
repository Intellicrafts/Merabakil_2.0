"""Structured schemas for inter-agent communication and orchestrator state."""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

from legalos_common.rag.filters import SearchFilters
from legalos_common.rag.schemas import Citation, ConfidenceBreakdown, RetrievedSource, WebImageResult, WebSearchResult


class ResearchScope(StrEnum):
    CORPUS = "corpus"
    DOCUMENT = "document"


class Intent(StrEnum):
    LEGAL_RESEARCH = "legal_research"
    LEGAL_ADVICE = "legal_advice"
    CONTRACT_REVIEW = "contract_review"
    DRAFTING = "drafting"
    LITIGATION = "litigation"
    COMPLIANCE = "compliance"
    LAWYER_MATCHING = "lawyer_matching"
    EVIDENCE_ANALYSIS = "evidence_analysis"


class IntentResult(BaseModel):
    intent: Intent
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str = ""


class JurisdictionResult(BaseModel):
    country: str = "india"
    level: str = "central"  # central | state | supreme_court | high_court | tribunal
    region: str | None = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)


class ConversationMessage(BaseModel):
    """A single turn in multi-turn chat passed from the client."""

    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


def _merge_trace(left: list[str], right: list[str]) -> list[str]:
    return [*left, *right]


class OrchestratorState(BaseModel):
    """Shared state threaded through the LangGraph nodes."""

    query: str
    jurisdiction_hint: str | None = None
    user_token: str | None = None
    scope: ResearchScope = ResearchScope.CORPUS
    search_filters: SearchFilters = Field(default_factory=SearchFilters)
    history: list[ConversationMessage] = Field(default_factory=list)

    intent: IntentResult | None = None
    jurisdiction: JurisdictionResult | None = None
    sources: list[RetrievedSource] = Field(default_factory=list)
    web_sources: list[WebSearchResult] = Field(default_factory=list)
    web_images: list[WebImageResult] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    answer: str = ""
    citations: list[Citation] = Field(default_factory=list)
    confidence: ConfidenceBreakdown | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    trace: Annotated[list[str], _merge_trace] = Field(default_factory=list)


class OrchestratorResult(BaseModel):
    query: str
    intent: Intent
    jurisdiction: JurisdictionResult
    answer: str
    sources: list[RetrievedSource]
    web_sources: list[WebSearchResult] = Field(default_factory=list)
    web_images: list[WebImageResult] = Field(default_factory=list)
    suggestions: list[str] = Field(default_factory=list)
    citations: list[Citation]
    confidence: ConfidenceBreakdown
    trace: list[str]
    specialist_payload: dict[str, Any] = Field(default_factory=dict)
