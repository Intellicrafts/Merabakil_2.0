from __future__ import annotations

import uuid
from decimal import Decimal

from app.application.ports import WalletRepository
from app.domain.entities import TransactionType, Wallet, WalletTransaction
from legalos_common.api.errors import AppError


class InsufficientFundsError(AppError):
    status_code = 402
    code = "insufficient_funds"


class WalletService:
    def __init__(
        self,
        repo: WalletRepository,
        *,
        welcome_credit: Decimal = Decimal("100.00"),
        currency: str = "INR",
    ) -> None:
        self._repo = repo
        self._welcome_credit = welcome_credit
        self._currency = currency

    async def get_or_create(self, user_id: uuid.UUID) -> Wallet:
        wallet = await self._repo.get_by_user(user_id)
        if wallet is not None:
            return wallet
        wallet = await self._repo.create(user_id, self._currency)
        if self._welcome_credit > Decimal("0"):
            await self._credit(
                wallet,
                amount=self._welcome_credit,
                transaction_type=TransactionType.TOP_UP,
                description="Welcome credit",
                reference_id=None,
            )
        return wallet

    async def top_up(
        self,
        user_id: uuid.UUID,
        amount: Decimal,
        description: str = "Manual top-up",
    ) -> WalletTransaction:
        if amount <= Decimal("0"):
            raise AppError("Top-up amount must be positive")
        if amount > Decimal("100000"):
            raise AppError("Top-up amount exceeds maximum of ₹1,00,000")
        wallet = await self.get_or_create(user_id)
        return await self._credit(
            wallet,
            amount=amount,
            transaction_type=TransactionType.TOP_UP,
            description=description,
            reference_id=None,
        )

    async def deduct(
        self,
        user_id: uuid.UUID,
        amount: Decimal,
        transaction_type: TransactionType,
        description: str,
        reference_id: str | None = None,
    ) -> WalletTransaction:
        if amount <= Decimal("0"):
            raise AppError("Deduction amount must be positive")
        wallet = await self.get_or_create(user_id)
        locked = await self._repo.lock_for_update(wallet.id)
        if locked.balance < amount:
            raise InsufficientFundsError(
                f"Insufficient wallet balance. Required ₹{amount}, available ₹{locked.balance}."
            )
        new_balance = locked.balance - amount
        locked.balance = new_balance
        await self._repo.save_balance(locked)
        return await self._repo.add_transaction(
            wallet=locked,
            transaction_type=transaction_type,
            amount=amount,
            balance_after=new_balance,
            description=description,
            reference_id=reference_id,
        )

    async def credit(
        self,
        user_id: uuid.UUID,
        amount: Decimal,
        transaction_type: TransactionType,
        description: str,
        reference_id: str | None = None,
    ) -> WalletTransaction:
        if amount <= Decimal("0"):
            raise AppError("Credit amount must be positive")
        wallet = await self.get_or_create(user_id)
        return await self._credit(
            wallet,
            amount=amount,
            transaction_type=transaction_type,
            description=description,
            reference_id=reference_id,
        )

    async def list_transactions(
        self,
        user_id: uuid.UUID,
        *,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[WalletTransaction], int]:
        offset = (page - 1) * size
        return await self._repo.list_transactions(user_id, offset=offset, limit=size)

    async def _credit(
        self,
        wallet: Wallet,
        *,
        amount: Decimal,
        transaction_type: TransactionType,
        description: str,
        reference_id: str | None,
    ) -> WalletTransaction:
        locked = await self._repo.lock_for_update(wallet.id)
        new_balance = locked.balance + amount
        locked.balance = new_balance
        await self._repo.save_balance(locked)
        return await self._repo.add_transaction(
            wallet=locked,
            transaction_type=transaction_type,
            amount=amount,
            balance_after=new_balance,
            description=description,
            reference_id=reference_id,
        )
