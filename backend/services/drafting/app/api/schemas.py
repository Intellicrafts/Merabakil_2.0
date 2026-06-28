from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class DraftingRequest(BaseModel):
    template_type: str = Field(min_length=1)
    variables: dict[str, Any] = Field(default_factory=dict)
    jurisdiction: str = "India"


class DraftingResponse(BaseModel):
    template_type: str
    jurisdiction: str
    draft_text: str
