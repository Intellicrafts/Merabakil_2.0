from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities import TransactionType, Wallet as WalletEntity, WalletTransaction as TxEntity
from app.infrastructure.models import Wallet, WalletTransaction


def _to_wallet_entity(m: Wallet) -> WalletEntity:
    return WalletEntity(
        id=m.id,
        user_id=m.user_id,
        balance=m.balance,
        currency=m.currency,
        created_at=m.created_at,
        updated_at=m.updated_at,
    )


def _to_tx_entity(m: WalletTransaction) -> TxEntity:
    return TxEntity(
        id=m.id,
        wallet_id=m.wallet_id,
        user_id=m.user_id,
        transaction_type=TransactionType(m.transaction_type),
        amount=m.amount,
        balance_after=m.balance_after,
        description=m.description,
        reference_id=m.reference_id,
        created_at=m.created_at,
    )


class SqlAlchemyWalletRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_user(self, user_id: uuid.UUID) -> WalletEntity | None:
        result = await self._session.execute(
            select(Wallet).where(Wallet.user_id == user_id)
        )
        row = result.scalar_one_or_none()
        return _to_wallet_entity(row) if row else None

    async def create(self, user_id: uuid.UUID, currency: str) -> WalletEntity:
        wallet = Wallet(user_id=user_id, balance=Decimal("0.00"), currency=currency)
        self._session.add(wallet)
        await self._session.flush()
        await self._session.refresh(wallet)
        return _to_wallet_entity(wallet)

    async def lock_for_update(self, wallet_id: uuid.UUID) -> WalletEntity:
        result = await self._session.execute(
            select(Wallet).where(Wallet.id == wallet_id).with_for_update()
        )
        row = result.scalar_one()
        return _to_wallet_entity(row)

    async def save_balance(self, wallet: WalletEntity) -> None:
        result = await self._session.execute(
            select(Wallet).where(Wallet.id == wallet.id).with_for_update()
        )
        row = result.scalar_one()
        row.balance = wallet.balance
        await self._session.flush()

    async def add_transaction(
        self,
        *,
        wallet: WalletEntity,
        transaction_type: TransactionType,
        amount: Decimal,
        balance_after: Decimal,
        description: str,
        reference_id: str | None,
    ) -> TxEntity:
        tx = WalletTransaction(
            wallet_id=wallet.id,
            user_id=wallet.user_id,
            transaction_type=transaction_type.value,
            amount=amount,
            balance_after=balance_after,
            description=description,
            reference_id=reference_id,
            created_at=datetime.now(timezone.utc),
        )
        self._session.add(tx)
        await self._session.flush()
        await self._session.refresh(tx)
        return _to_tx_entity(tx)

    async def list_transactions(
        self,
        user_id: uuid.UUID,
        *,
        offset: int,
        limit: int,
    ) -> tuple[list[TxEntity], int]:
        count_result = await self._session.execute(
            select(func.count()).select_from(WalletTransaction).where(
                WalletTransaction.user_id == user_id
            )
        )
        total = count_result.scalar_one()

        result = await self._session.execute(
            select(WalletTransaction)
            .where(WalletTransaction.user_id == user_id)
            .order_by(WalletTransaction.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        rows = list(result.scalars().all())
        return [_to_tx_entity(r) for r in rows], total
