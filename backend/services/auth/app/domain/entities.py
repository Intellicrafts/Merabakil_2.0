"""Auth domain entities and value objects (framework-independent)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(slots=True)
class UserEntity:
    id: uuid.UUID
    email: str
    full_name: str
    hashed_password: str
    is_active: bool
    is_verified: bool
    roles: list[str] = field(default_factory=list)
    permissions: list[str] = field(default_factory=list)
    created_at: datetime | None = None

    def can_login(self) -> bool:
        return self.is_active
