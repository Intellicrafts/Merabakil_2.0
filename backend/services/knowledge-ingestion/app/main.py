"""Knowledge Ingestion Service ASGI application."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import get_settings
from app.infrastructure.container import init_container
from legalos_common.api import (
    RequestContextMiddleware,
    build_health_router,
    register_exception_handlers,
)
from legalos_common.logging import configure_logging, get_logger
from legalos_common.telemetry import setup_telemetry

settings = get_settings()
configure_logging(settings.service_name, settings.log_level)
logger = get_logger(__name__)
container = init_container(settings)


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await container.startup()
    except Exception:
        logger.exception("ingestion_startup_partial_failure")
    yield
    await container.shutdown()


app = FastAPI(
    title="AI Legal OS - Knowledge Ingestion Service",
    version="0.1.0",
    description="PDF/OCR parsing, chunking, embedding, Qdrant indexing and Neo4j graph population.",
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
