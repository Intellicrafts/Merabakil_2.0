"""Redis-backed fixed-window rate limiter for Gemini quota protection.

Usage in a FastAPI dependency:

    async def my_dep(
        user: CurrentUser = Depends(require_permissions(...)),
        redis: Redis = Depends(get_redis),
    ) -> CurrentUser:
        await check_rate_limit(redis, key=f"rate:chat:{user.user_id}", limit=20, window=60)
        return user
"""

from __future__ import annotations

from fastapi import HTTPException, status


async def check_rate_limit(
    redis,
    *,
    key: str,
    limit: int,
    window_seconds: int,
) -> None:
    """Fixed-window rate check using Redis INCR + EXPIRE NX.

    Raises HTTP 429 when the user exceeds *limit* calls within *window_seconds*.
    Silently passes if Redis is unavailable (fail-open to avoid blocking users).
    """
    if redis is None:
        return

    try:
        pipe = redis.pipeline(transaction=False)
        pipe.incr(key)
        pipe.expire(key, window_seconds, nx=True)  # set TTL only on first increment
        results = await pipe.execute()
        count: int = results[0]
    except Exception:
        return  # Redis hiccup — fail open

    if count > limit:
        window_min = window_seconds // 60 or window_seconds
        unit = "min" if window_seconds >= 60 else "sec"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded — max {limit} requests per {window_min} {unit}. Please wait and try again.",
            headers={"Retry-After": str(window_seconds)},
        )
