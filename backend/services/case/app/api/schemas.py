"""Pydantic schemas for the case service API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class CreateCaseRequest(BaseModel):
    title: str = Field(..., max_length=200)
    description: str = ""
    case_number: str = ""
    court: str = ""
    jurisdiction: str = ""
    practice_area: str = ""
    status: Literal["draft", "open", "in_progress", "closed"] = "open"
    source: Literal["manual", "saarthi"] = "manual"
    session_id: str | None = None
    ai_brief: dict[str, Any] = Field(default_factory=dict)


class UpdateCaseRequest(BaseModel):
    title: str | None = Field(None, max_length=200)
    description: str | None = None
    case_number: str | None = None
    court: str | None = None
    jurisdiction: str | None = None
    practice_area: str | None = None
    status: Literal["draft", "open", "in_progress", "closed"] | None = None
    ai_brief: dict[str, Any] | None = None


class ShareCaseRequest(BaseModel):
    lawyer_user_id: str
    message: str = ""


class CaseResponse(BaseModel):
    id: str
    owner_id: str
    title: str
    description: str
    case_number: str
    court: str
    jurisdiction: str
    practice_area: str
    status: str
    source: str
    session_id: str | None
    ai_brief: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class CaseShareResponse(BaseModel):
    id: str
    case_id: str
    shared_by_user_id: str
    lawyer_user_id: str
    message: str
    shared_at: datetime
    revoked_at: datetime | None
