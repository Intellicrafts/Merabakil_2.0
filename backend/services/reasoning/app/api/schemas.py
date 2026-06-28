from __future__ import annotations

from pydantic import BaseModel, Field


class ReasoningRequest(BaseModel):
    query: str = Field(min_length=1)
    facts: str | None = None
    document_id: str | None = None


class RiskIssue(BaseModel):
    title: str
    severity: str
    detail: str


class RiskAssessment(BaseModel):
    issues: list[RiskIssue]
    strength_score: float = Field(ge=0.0, le=1.0)
    missing_facts: list[str]
    recommended_next_steps: list[str]
