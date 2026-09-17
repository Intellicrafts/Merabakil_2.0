from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.domain.entities import TransactionType


class WalletResponse(BaseModel):
    user_id: str
    balance: str
    currency: str

    @classmethod
    def from_entity(cls, user_id: uuid.UUID, balance: Decimal, currency: str) -> "WalletResponse":
        return cls(user_id=str(user_id), balance=str(balance), currency=currency)


class TopUpRequest(BaseModel):
    amount: Decimal = Field(..., gt=0, le=100000, description="Amount in INR to add")
    description: str = Field(default="Manual top-up", max_length=255)


class WalletTransactionOut(BaseModel):
    id: str
    wallet_id: str
    user_id: str
    transaction_type: str
    amount: str
    balance_after: str
    description: str
    reference_id: str | None
    created_at: str


class TransactionListResponse(BaseModel):
    items: list[WalletTransactionOut]
    total: int
    page: int
    size: int


class InternalDeductRequest(BaseModel):
    user_id: uuid.UUID
    amount: Decimal = Field(..., gt=0)
    transaction_type: TransactionType
    description: str
    reference_id: str | None = None


class InternalCreditRequest(BaseModel):
    user_id: uuid.UUID
    amount: Decimal = Field(..., gt=0)
    transaction_type: TransactionType
    description: str
    reference_id: str | None = None


class InternalTransactionResponse(BaseModel):
    transaction_id: str
    user_id: str
    balance_after: str


class AdminAdjustRequest(BaseModel):
    amount: Decimal = Field(..., gt=0, le=1000000, description="Amount in INR")
    type: Literal["credit", "debit"]
    reason: str = Field(..., min_length=1, max_length=500)


class WalletListResponse(BaseModel):
    items: list[WalletResponse]
    total: int
    page: int
    size: int
