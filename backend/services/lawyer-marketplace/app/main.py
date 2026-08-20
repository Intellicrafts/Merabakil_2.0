"""Lawyer-Marketplace Service ASGI application."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from legalos_common.api import (
    RequestContextMiddleware,
    build_health_router,
    register_exception_handlers,
)
from legalos_common.config import get_common_settings
from legalos_common.logging import configure_logging
from legalos_common.telemetry import setup_telemetry

settings = get_common_settings()
configure_logging(settings.service_name, settings.log_level)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(
    title="AI Legal OS - Lawyer Marketplace",
    version="0.1.0",
    description="Lawyer profiles, LLM-generated summaries, and agent-driven matching.",
    lifespan=lifespan,
)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
setup_telemetry(app, settings)

app.include_router(build_health_router("lawyer-marketplace"))
app.include_router(router)
