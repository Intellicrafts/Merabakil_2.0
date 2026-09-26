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
) -> int:
    """Fixed-window rate check using Redis INCR + EXPIRE NX.

    Raises HTTP 429 when the user exceeds *limit* calls within *window_seconds*.
    Returns the count used in the current window (0 when Redis is unavailable —
    fail-open to avoid blocking users).
    """
    if redis is None:
        return 0

    try:
        pipe = redis.pipeline(transaction=False)
        pipe.incr(key)
        pipe.expire(key, window_seconds, nx=True)  # set TTL only on first increment
        results = await pipe.execute()
        count: int = results[0]
    except Exception:
        return 0  # Redis hiccup — fail open

    if count > limit:
        if window_seconds >= 86_400:
            window_label = f"{window_seconds // 86_400} day"
        elif window_seconds >= 3_600:
            window_label = f"{window_seconds // 3_600} hr"
        elif window_seconds >= 60:
            window_label = f"{window_seconds // 60} min"
        else:
            window_label = f"{window_seconds} sec"
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded — max {limit} requests per {window_label}. Please wait and try again.",
            headers={"Retry-After": str(window_seconds)},
        )
    return count
