"""Request and response schemas for the lawyer-marketplace API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CreateLawyerRequest(BaseModel):
    user_id: str
    full_name: str
    bar_council_id: str | None = None
    practice_areas: list[str] = Field(default_factory=list)
    jurisdictions: list[str] = Field(default_factory=list)
    years_experience: int = 0
    languages: list[str] = Field(default_factory=list)
    hourly_rate: float | None = None
    bio: str | None = None
    is_verified: bool = False


class MatchRequest(BaseModel):
    practice_areas: list[str] = Field(default_factory=list)
    jurisdictions: list[str] = Field(default_factory=list)
    limit: int = Field(default=3, ge=1, le=10)


class LawyerMatchResult(BaseModel):
    id: str
    full_name: str
    bar_council_id: str | None
    practice_areas: list[str]
    jurisdictions: list[str]
    years_experience: int
    languages: list[str]
    rating: float
    rating_count: int
    hourly_rate: float | None
    is_verified: bool
    summary: str
    match_score: float = 1.0
    ai_recommended: bool = True


class SummaryResponse(BaseModel):
    lawyer_id: str
    summary: str


class BatchSummaryResponse(BaseModel):
    generated: int
    skipped: int
