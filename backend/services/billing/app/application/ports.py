from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Protocol

from app.domain.entities import TransactionType, Wallet, WalletTransaction


class WalletRepository(Protocol):
    async def get_by_user(self, user_id: uuid.UUID) -> Wallet | None: ...

    async def create(self, user_id: uuid.UUID, currency: str) -> Wallet: ...

    async def lock_for_update(self, wallet_id: uuid.UUID) -> Wallet: ...

    async def save_balance(self, wallet: Wallet) -> None: ...

    async def add_transaction(
        self,
        *,
        wallet: Wallet,
        transaction_type: TransactionType,
        amount: Decimal,
        balance_after: Decimal,
        description: str,
        reference_id: str | None,
    ) -> WalletTransaction: ...

    async def list_transactions(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[WalletTransaction], int]: ...
