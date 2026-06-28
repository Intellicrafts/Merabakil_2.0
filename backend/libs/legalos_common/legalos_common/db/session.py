"""Async SQLAlchemy session management."""

from __future__ import annotations

import contextlib
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


class DatabaseSessionManager:
    """Owns the async engine and session factory for a service."""

    def __init__(self, dsn: str, *, echo: bool = False) -> None:
        self._engine: AsyncEngine = create_async_engine(
            dsn,
            echo=echo,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
        self._sessionmaker = async_sessionmaker(
            bind=self._engine,
            expire_on_commit=False,
            autoflush=False,
        )

    @property
    def engine(self) -> AsyncEngine:
        return self._engine

    async def close(self) -> None:
        await self._engine.dispose()

    @contextlib.asynccontextmanager
    async def session(self) -> AsyncIterator[AsyncSession]:
        session = self._sessionmaker()
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

    async def fastapi_session(self) -> AsyncIterator[AsyncSession]:
        """FastAPI dependency that yields a transactional session."""
        async with self.session() as session:
            yield session


def create_session_manager(dsn: str, *, echo: bool = False) -> DatabaseSessionManager:
    return DatabaseSessionManager(dsn, echo=echo)
