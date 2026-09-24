"""FastAPI dependencies for per-user Gemini quota protection.

Limits (per user, per window):
  - chat / research : 20 req / 60 s   — ~1 message every 3 s sustained
  - TTS             : 30 req / 60 s   — follows chat cadence
  - voice live      : 5  req / 60 s   — each session is expensive (per-min billing)
  - case extraction : 10 req / 60 s   — background task, lower volume expected
  - courtroom       : 10 req / 60 s   — multi-agent, heaviest LLM usage
"""

from __future__ import annotations

import hashlib

from fastapi import Depends, Request

from app.infrastructure.container import get_container
from legalos_common.security.rate_limit import check_rate_limit
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions


def _client_ip(request: Request) -> str:
    """Real client IP behind nginx (first X-Forwarded-For hop), else peer."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def guest_chat_rate_limit(request: Request) -> None:
    """Anonymous guest chat: 5 messages/day per IP — server-side backstop to the
    client counter. No auth; used by POST /research/stream/guest."""
    container = get_container()
    ip_hash = hashlib.sha256(_client_ip(request).encode()).hexdigest()[:32]
    await check_rate_limit(
        container.redis,
        key=f"rate:guest:chat:{ip_hash}",
        limit=5,
        window_seconds=86_400,
    )


async def guest_voice_rate_limit(request: Request) -> None:
    """Anonymous guest voice: one session/day per IP. Gates the guest voice-token
    issuance (voice itself is realtime + costly, so the cap is strict)."""
    container = get_container()
    ip_hash = hashlib.sha256(_client_ip(request).encode()).hexdigest()[:32]
    await check_rate_limit(
        container.redis,
        key=f"rate:guest:voice:{ip_hash}",
        limit=1,
        window_seconds=86_400,
    )


async def chat_rate_limit(
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> CurrentUser:
    container = get_container()
    await check_rate_limit(
        container.redis,
        key=f"rate:chat:{current_user.user_id}",
        limit=20,
        window_seconds=60,
    )
    await check_rate_limit(
        container.redis,
        key=f"rate:chat:daily:{current_user.user_id}",
        limit=20,
        window_seconds=86_400,
    )
    return current_user


async def tts_rate_limit(
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> CurrentUser:
    container = get_container()
    await check_rate_limit(
        container.redis,
        key=f"rate:tts:{current_user.user_id}",
        limit=30,
        window_seconds=60,
    )
    return current_user


async def voice_rate_limit(
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> CurrentUser:
    container = get_container()
    await check_rate_limit(
        container.redis,
        key=f"rate:voice:{current_user.user_id}",
        limit=5,
        window_seconds=60,
    )
    return current_user


async def extraction_rate_limit(
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> CurrentUser:
    container = get_container()
    await check_rate_limit(
        container.redis,
        key=f"rate:extraction:{current_user.user_id}",
        limit=10,
        window_seconds=60,
    )
    return current_user


