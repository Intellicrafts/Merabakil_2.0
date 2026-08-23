"""Lawyer-Marketplace Service ASGI application."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

logger = logging.getLogger(__name__)
from fastapi.middleware.cors import CORSMiddleware

from app.api.marketplace_api import admin_router, appointments_router, lawyers_router
from app.infrastructure.appointment_repo import MarketplaceRepository
from app.infrastructure.db import get_engine, init_db, session_scope
from app.infrastructure.lawyer_vector_store import get_lawyer_vector_store
from app.infrastructure.seed import seed_lawyers
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
    await init_db()
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.infrastructure.db import _sessionmaker, get_engine as _ge

    _ge()
    assert _sessionmaker is not None
    session = _sessionmaker()
    try:
        await seed_lawyers(session)
        await session.commit()
    except Exception as exc:  # FK violation if demo user doesn't exist in auth DB
        logger.warning("seed_lawyers skipped: %s", exc)
        await session.rollback()
    finally:
        await session.close()

    # Start vector store (non-fatal — logs warning if Qdrant is unreachable)
    store = get_lawyer_vector_store()
    await store.startup()
    if store.is_ready:
        async with session_scope() as idx_session:
            idx_repo = MarketplaceRepository(idx_session)
            for lawyer in await idx_repo.list_all_lawyers():
                if lawyer.summary:
                    await store.upsert(lawyer)
        logger.info("startup_lawyer_index_complete")

    yield
    engine = get_engine()
    await engine.dispose()


app = FastAPI(
    title="AI Legal OS - Lawyer Marketplace",
    version="0.2.0",
    description="Verified counsel listings, appointments, and room tokens.",
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
app.include_router(lawyers_router)
app.include_router(appointments_router)
app.include_router(admin_router)
