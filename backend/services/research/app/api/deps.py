"""FastAPI dependencies: authentication for members and quota protection.

Limits:
  - chat / research : 20 req / 60 s and 20 req / day per member
  - transcription   : 20 req / 60 s and 60 req / day per member (separate budget)
  - TTS             : 30 req / 60 s per member
  - voice live      : 5 sessions / 60 s per member
  - case extraction : 10 req / 60 s per member
  - guest chat      : 5 / day per IP, plus a global daily guest budget
  - guest voice     : 1 token / day per IP

Chat quotas are enforced inside the handlers (``enforce_*``) — after FastAPI has
validated the body — so a rejected request never uses up a message.
"""

from __future__ import annotations

import hashlib
import os
from datetime import UTC, datetime

from fastapi import Depends, HTTPException, Request, status

from app.infrastructure.container import get_container
from legalos_common.security.rate_limit import check_rate_limit
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions

GUEST_CHAT_DAILY_LIMIT = 5
GUEST_GLOBAL_DAILY_BUDGET = int(os.environ.get("GUEST_GLOBAL_DAILY_BUDGET", "3000"))


def client_ip(request: Request) -> str:
    """Real client IP. nginx sets X-Real-IP from the TCP peer; X-Forwarded-For is
    client-controlled (nginx appends to whatever was sent) and is never trusted."""
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def _ip_hash(request: Request) -> str:
    return hashlib.sha256(client_ip(request).encode()).hexdigest()[:32]


async def member_user(
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> CurrentUser:
    """A signed-in account. Anonymous guest tokens are rejected here."""
    if current_user.is_guest:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sign in to continue.")
    return current_user


async def enforce_guest_chat_quota(request: Request) -> int:
    """Count one guest message; returns how many remain today for this IP."""
    container = get_container()
    day = datetime.now(UTC).strftime("%Y%m%d")
    await check_rate_limit(
        container.redis,
        key=f"rate:guest:global:{day}",
        limit=GUEST_GLOBAL_DAILY_BUDGET,
        window_seconds=86_400,
    )
    used = await check_rate_limit(
        container.redis,
        key=f"rate:guest:chat:{_ip_hash(request)}",
        limit=GUEST_CHAT_DAILY_LIMIT,
        window_seconds=86_400,
    )
    return max(0, GUEST_CHAT_DAILY_LIMIT - used) if used else GUEST_CHAT_DAILY_LIMIT - 1


async def guest_voice_rate_limit(request: Request) -> None:
    """Anonymous guest voice: one token/day per IP (voice is realtime + costly)."""
    container = get_container()
    await check_rate_limit(
        container.redis,
        key=f"rate:guest:voice:{_ip_hash(request)}",
        limit=1,
        window_seconds=86_400,
    )


async def enforce_chat_limits(user: CurrentUser) -> None:
    container = get_container()
    await check_rate_limit(container.redis, key=f"rate:chat:{user.user_id}", limit=20, window_seconds=60)
    await check_rate_limit(
        container.redis, key=f"rate:chat:daily:{user.user_id}", limit=20, window_seconds=86_400
    )


async def enforce_transcribe_limits(user: CurrentUser) -> None:
    container = get_container()
    await check_rate_limit(
        container.redis, key=f"rate:transcribe:{user.user_id}", limit=20, window_seconds=60
    )
    await check_rate_limit(
        container.redis, key=f"rate:transcribe:daily:{user.user_id}", limit=60, window_seconds=86_400
    )


async def tts_rate_limit(current_user: CurrentUser = Depends(member_user)) -> CurrentUser:
    container = get_container()
    await check_rate_limit(
        container.redis, key=f"rate:tts:{current_user.user_id}", limit=30, window_seconds=60
    )
    await check_rate_limit(
        container.redis, key=f"rate:tts:daily:{current_user.user_id}", limit=200, window_seconds=86_400
    )
    return current_user


async def voice_rate_limit(current_user: CurrentUser = Depends(member_user)) -> CurrentUser:
    container = get_container()
    await check_rate_limit(
        container.redis, key=f"rate:voice:{current_user.user_id}", limit=5, window_seconds=60
    )
    return current_user


async def extraction_rate_limit(current_user: CurrentUser = Depends(member_user)) -> CurrentUser:
    container = get_container()
    await check_rate_limit(
        container.redis, key=f"rate:extraction:{current_user.user_id}", limit=10, window_seconds=60
    )
    return current_user
