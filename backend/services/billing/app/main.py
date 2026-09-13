"""Billing Service ASGI application."""
from __future__ import annotations

from contextlib import asynccontextmanager
from decimal import Decimal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.internal_routes import internal_router
from app.api.routes import router
from app.config import get_settings
from app.infrastructure.db import session_manager
from app.infrastructure.stream_consumer import UserEventConsumer
from legalos_common.api import (
    RequestContextMiddleware,
    build_health_router,
    register_exception_handlers,
)
from legalos_common.logging import configure_logging
from legalos_common.telemetry import setup_telemetry

settings = get_settings()
configure_logging(settings.service_name, settings.log_level)

_consumer = UserEventConsumer(
    redis_url=settings.redis_url,
    welcome_credit=Decimal(settings.welcome_credit_inr),
    session_manager=session_manager,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await _consumer.start()
    yield
    await _consumer.stop()


app = FastAPI(
    title="AI Legal OS - Billing Service",
    version="0.1.0",
    description="Wallet management, top-up, and transaction history.",
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

app.include_router(build_health_router(settings.service_name))
app.include_router(router)
app.include_router(internal_router)
