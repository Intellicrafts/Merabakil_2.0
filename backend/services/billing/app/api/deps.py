from __future__ import annotations

from decimal import Decimal

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.wallet_service import WalletService
from app.config import get_settings
from app.infrastructure.db import get_session
from app.infrastructure.repositories import SqlAlchemyWalletRepository

_settings = get_settings()


def get_wallet_service(session: AsyncSession = Depends(get_session)) -> WalletService:
    return WalletService(
        SqlAlchemyWalletRepository(session),
        welcome_credit=Decimal(_settings.welcome_credit_inr),
    )
