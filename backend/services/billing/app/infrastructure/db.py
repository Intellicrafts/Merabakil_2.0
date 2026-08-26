from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from legalos_common.db import DatabaseSessionManager

_settings = get_settings()
session_manager = DatabaseSessionManager(_settings.postgres.dsn())


async def get_session() -> AsyncIterator[AsyncSession]:
    async with session_manager.session() as session:
        yield session
        await session.commit()
