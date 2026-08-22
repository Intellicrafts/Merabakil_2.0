"""Marketplace session factory — SQLite for native demo, Postgres in production."""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from legalos_common.db import Base

_ROOT = Path(__file__).resolve().parents[5]
_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def marketplace_dsn() -> str:
    override = os.getenv("MARKETPLACE_DATABASE_URL")
    if override:
        return override
    native = os.getenv("MARKETPLACE_NATIVE", "true").lower() in {"1", "true", "yes"}
    if native:
        path = _ROOT / "data" / "marketplace.db"
        path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{path}"
    from legalos_common.config import PostgresSettings

    return PostgresSettings().dsn(async_driver=True)


def get_engine() -> AsyncEngine:
    global _engine, _sessionmaker
    if _engine is None:
        dsn = marketplace_dsn()
        kwargs: dict = {"echo": False}
        if dsn.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
        else:
            kwargs["pool_pre_ping"] = True
            kwargs["pool_size"] = 10
            kwargs["max_overflow"] = 20
        _engine = create_async_engine(dsn, **kwargs)
        _sessionmaker = async_sessionmaker(bind=_engine, expire_on_commit=False, autoflush=False)
    return _engine


def _ensure_sqlite_columns(sync_conn) -> None:
    if sync_conn.dialect.name != "sqlite":
        return
    existing = {
        row[1] for row in sync_conn.exec_driver_sql("PRAGMA table_info(appointment_messages)").fetchall()
    }
    if existing:
        if "kind" not in existing:
            sync_conn.exec_driver_sql(
                "ALTER TABLE appointment_messages ADD COLUMN kind VARCHAR(20) DEFAULT 'text'"
            )
        if "attachment_id" not in existing:
            sync_conn.exec_driver_sql("ALTER TABLE appointment_messages ADD COLUMN attachment_id VARCHAR(36)")
    consult = {
        row[1] for row in sync_conn.exec_driver_sql("PRAGMA table_info(consultations)").fetchall()
    }
    if not consult:
        return
    for name, decl in (
        ("priority", "VARCHAR(20) DEFAULT 'normal'"),
        ("emergency_status", "VARCHAR(20) DEFAULT 'none'"),
        ("emergency_reason", "TEXT DEFAULT ''"),
        ("emergency_at", "DATETIME"),
        ("emergency_ack_at", "DATETIME"),
        ("emergency_resolved_at", "DATETIME"),
        ("assigned_admin_user_id", "VARCHAR(36)"),
        ("ops_note", "TEXT DEFAULT ''"),
    ):
        if name not in consult:
            sync_conn.exec_driver_sql(f"ALTER TABLE consultations ADD COLUMN {name} {decl}")


async def init_db() -> None:
    # Import models so metadata is populated.
    from app.infrastructure import appointment_models as _am  # noqa: F401
    from app.infrastructure import lawyer_model as _lm  # noqa: F401

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_sqlite_columns)


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    if _sessionmaker is None:
        get_engine()
    assert _sessionmaker is not None
    session = _sessionmaker()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def get_session() -> AsyncIterator[AsyncSession]:
    async with session_scope() as session:
        yield session


# Alias used by lawyer listing routes from origin/main.
get_async_session = get_session
