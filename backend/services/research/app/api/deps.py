"""FastAPI dependencies: authentication for members and quota protection.

Limits:
  - chat / research : 20 req / 60 s and 20 req / day per member
  - transcription   : 20 req / 60 s and 60 req / day per member (separate budget)
  - TTS             : 30 req / 60 s per member
  - voice live      : 5 sessions / 60 s per member
  - case extraction : 10 req / 60 s per member
  - guest chat      : 5 / IST day per device (first-party id from the browser),
                      an IP ceiling of 50 / IST day with a Turnstile bot check
                      above it, plus a global daily guest budget
  - guest voice     : 1 token / day per IP

Chat quotas are enforced inside the handlers (``enforce_*``) — after FastAPI has
validated the body — so a rejected request never uses up a message.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from fastapi import Depends, HTTPException, Request, status

from app.infrastructure.container import get_container
from legalos_common.security.rate_limit import check_rate_limit
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")
GUEST_CHAT_DAILY_LIMIT = 5  # per device; resets at midnight IST (the UI says so)
GUEST_IP_DAILY_CEILING = int(os.environ.get("GUEST_IP_DAILY_CEILING", "50"))
GUEST_GLOBAL_DAILY_BUDGET = int(os.environ.get("GUEST_GLOBAL_DAILY_BUDGET", "3000"))
TURNSTILE_SECRET_KEY = os.environ.get("TURNSTILE_SECRET_KEY", "")
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
_DEVICE_ID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


def client_ip(request: Request) -> str:
    """Real client IP. nginx sets X-Real-IP from the TCP peer; X-Forwarded-For is
    client-controlled (nginx appends to whatever was sent) and is never trusted."""
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:32]


def _ip_hash(request: Request) -> str:
    return _hash(client_ip(request))


def ist_day_window(now: datetime | None = None) -> tuple[str, int]:
    """Today's date in IST and the seconds left until IST midnight, when guest limits reset."""
    local = (now or datetime.now(UTC)).astimezone(IST)
    midnight = (local + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return local.strftime("%Y%m%d"), max(1, int((midnight - local).total_seconds()))


def guest_device_key(request: Request) -> str:
    """The browser's random first-party id (``X-Guest-Id``). Clients from before
    device ids fall back to the IP."""
    device = (request.headers.get("x-guest-id") or "").strip().lower()
    if _DEVICE_ID_RE.match(device):
        return f"d:{_hash(device)}"
    return f"ip:{_ip_hash(request)}"


async def verify_turnstile(token: str, ip: str) -> bool:
    if not TURNSTILE_SECRET_KEY or not token:
        return False
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                TURNSTILE_VERIFY_URL,
                data={"secret": TURNSTILE_SECRET_KEY, "response": token, "remoteip": ip},
            )
            return bool(resp.json().get("success"))
    except Exception as exc:
        logger.warning("turnstile_verify_failed error=%s", type(exc).__name__)
        return False


async def _count(redis, key: str, ttl: int) -> int:
    pipe = redis.pipeline(transaction=False)
    pipe.incr(key)
    pipe.expire(key, ttl, nx=True)
    return int((await pipe.execute())[0])


async def member_user(
    current_user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> CurrentUser:
    """A signed-in account. Anonymous guest tokens are rejected here."""
    if current_user.is_guest:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sign in to continue.")
    return current_user


async def _pass_ip_ceiling(request: Request, redis, *, day: str, resets_in: int, device: str) -> None:
    """Many real people share one IP (mobile carriers, offices). Up to the ceiling
    nothing is asked; above it each device proves once a day that it is human."""
    ip = client_ip(request)
    try:
        ip_used = int(await redis.get(f"rate:guest:ip:{day}:{_hash(ip)}") or 0)
        if ip_used < GUEST_IP_DAILY_CEILING or await redis.get(f"guest:human:{day}:{device}"):
            return
    except Exception:
        return  # Redis hiccup — fail open, like check_rate_limit
    retry = {"Retry-After": str(resets_in)}
    if not TURNSTILE_SECRET_KEY:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="Daily free limit reached.", headers=retry)
    token = request.headers.get("x-turnstile-token", "")
    if not token or not await verify_turnstile(token, ip):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail={"code": "challenge_required"})
    await redis.set(f"guest:human:{day}:{device}", "1", ex=resets_in)


async def enforce_guest_chat_quota(request: Request) -> int:
    """Count one guest message; returns how many this device has left today (IST)."""
    container = get_container()
    redis = container.redis
    day, resets_in = ist_day_window()
    device = guest_device_key(request)
    await check_rate_limit(
        redis, key=f"rate:guest:global:{day}", limit=GUEST_GLOBAL_DAILY_BUDGET, window_seconds=resets_in
    )
    if redis is None:
        return GUEST_CHAT_DAILY_LIMIT - 1
    await _pass_ip_ceiling(request, redis, day=day, resets_in=resets_in, device=device)
    used = await check_rate_limit(
        redis, key=f"rate:guest:chat:{day}:{device}", limit=GUEST_CHAT_DAILY_LIMIT, window_seconds=resets_in
    )
    try:
        await _count(redis, f"rate:guest:ip:{day}:{_ip_hash(request)}", resets_in)
    except Exception:
        pass
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
