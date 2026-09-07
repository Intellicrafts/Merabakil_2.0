"""FastAPI dependencies for per-user Gemini quota protection.

Limits (per user, per window):
  - chat / research : 20 req / 60 s   — ~1 message every 3 s sustained
  - TTS             : 30 req / 60 s   — follows chat cadence
  - voice live      : 5  req / 60 s   — each session is expensive (per-min billing)
  - case extraction : 10 req / 60 s   — background task, lower volume expected
  - courtroom       : 10 req / 60 s   — multi-agent, heaviest LLM usage
"""

from __future__ import annotations

from fastapi import Depends

from app.infrastructure.container import get_container
from legalos_common.security.rate_limit import check_rate_limit
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions


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


async def courtroom_rate_limit(
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> CurrentUser:
    container = get_container()
    await check_rate_limit(
        container.redis,
        key=f"rate:courtroom:{current_user.user_id}",
        limit=10,
        window_seconds=60,
    )
    return current_user
