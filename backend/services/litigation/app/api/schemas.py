from __future__ import annotations

from pydantic import BaseModel, Field


class LitigationStrategyRequest(BaseModel):
    query: str = Field(min_length=1)
    facts: str | None = None


class LitigationStrategyResponse(BaseModel):
    forum: str
    limitation_concerns: list[str]
    procedural_steps: list[str]
    required_documents: list[str]
