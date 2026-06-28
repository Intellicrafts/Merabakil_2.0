from __future__ import annotations

from pydantic import BaseModel, Field


class ContractReviewRequest(BaseModel):
    query: str = Field(min_length=1)
    facts: str | None = None
    document_id: str | None = None
    text: str | None = None


class ContractClause(BaseModel):
    name: str
    summary: str
    risk: str


class ContractReviewResponse(BaseModel):
    clauses: list[ContractClause]
    missing_clauses: list[str]
    risk_score: float = Field(ge=0.0, le=1.0)
    flags: list[str]
