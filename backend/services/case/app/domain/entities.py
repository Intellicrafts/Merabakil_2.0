"""Case domain entities."""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any


class CaseSource(StrEnum):
    MANUAL = "manual"
    SAARTHI = "saarthi"


class CaseStatus(StrEnum):
    DRAFT = "draft"
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CLOSED = "closed"


@dataclass
class Case:
    id: uuid.UUID
    owner_id: uuid.UUID
    title: str
    description: str
    case_number: str
    court: str
    jurisdiction: str
    practice_area: str
    status: CaseStatus
    source: CaseSource
    session_id: str | None
    ai_brief: dict[str, Any]
    created_at: datetime
    updated_at: datetime


@dataclass
class CaseShare:
    id: uuid.UUID
    case_id: uuid.UUID
    shared_by_user_id: uuid.UUID
    lawyer_user_id: uuid.UUID
    message: str
    shared_at: datetime
    revoked_at: datetime | None = field(default=None)
