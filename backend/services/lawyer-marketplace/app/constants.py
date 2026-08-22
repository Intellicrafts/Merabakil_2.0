"""Stable demo identities shared by native auth and marketplace seed."""

from __future__ import annotations

import uuid

ADMIN_USER_ID = uuid.UUID("00000000-0000-4000-8000-000000000001")
ADVOCATE_USER_ID = uuid.UUID("00000000-0000-4000-8000-000000000010")
CITIZEN_USER_ID = uuid.UUID("00000000-0000-4000-8000-000000000011")

PRIYA_LAWYER_ID = uuid.UUID("00000000-0000-4000-8000-000000000101")
PRIYA_SLUG = "lw-001"

WINDOW_MINUTES = 60
SUMMON_TTL_SECONDS = 120
PRESENCE_TTL_SECONDS = 25

PRIORITIES = frozenset({"normal", "urgent", "emergency"})
EMERGENCY_STATUSES = frozenset({"none", "open", "ack", "resolved"})
