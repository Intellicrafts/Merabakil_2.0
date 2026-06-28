"""Standard liveness/readiness endpoints."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import APIRouter


def build_health_router(
    service_name: str,
    *,
    readiness_check: Callable[[], Awaitable[bool]] | None = None,
) -> APIRouter:
    router = APIRouter(tags=["health"])

    @router.get("/health", summary="Liveness probe")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": service_name}

    @router.get("/ready", summary="Readiness probe")
    async def ready() -> dict[str, str]:
        if readiness_check is not None:
            ok = await readiness_check()
            return {"status": "ready" if ok else "degraded", "service": service_name}
        return {"status": "ready", "service": service_name}

    return router
