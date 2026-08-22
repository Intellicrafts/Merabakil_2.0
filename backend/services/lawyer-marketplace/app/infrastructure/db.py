"""Service-scoped database session manager."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from legalos_common.config import get_common_settings
from legalos_common.db import DatabaseSessionManager

_settings = get_common_settings()
session_manager = DatabaseSessionManager(_settings.postgres.dsn())


async def get_async_session() -> AsyncIterator[AsyncSession]:
    async with session_manager.session() as session:
        yield session
        await session.commit()
