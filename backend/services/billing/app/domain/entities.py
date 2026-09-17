from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum


class TransactionType(StrEnum):
    TOP_UP = "TOP_UP"
    CHATBOT_USAGE = "CHATBOT_USAGE"
    APPOINTMENT_BOOKING = "APPOINTMENT_BOOKING"
    APPOINTMENT_REFUND = "APPOINTMENT_REFUND"
    ADVOCATE_EARNING = "ADVOCATE_EARNING"
    ADMIN_CREDIT = "ADMIN_CREDIT"
    ADMIN_DEBIT = "ADMIN_DEBIT"


CREDIT_TYPES = frozenset({
    TransactionType.TOP_UP,
    TransactionType.APPOINTMENT_REFUND,
    TransactionType.ADVOCATE_EARNING,
    TransactionType.ADMIN_CREDIT,
})

DEBIT_TYPES = frozenset({
    TransactionType.CHATBOT_USAGE,
    TransactionType.APPOINTMENT_BOOKING,
    TransactionType.ADMIN_DEBIT,
})


@dataclass(slots=True)
class Wallet:
    id: uuid.UUID
    user_id: uuid.UUID
    balance: Decimal
    currency: str
    created_at: datetime
    updated_at: datetime


@dataclass(slots=True)
class WalletTransaction:
    id: uuid.UUID
    wallet_id: uuid.UUID
    user_id: uuid.UUID
    transaction_type: TransactionType
    amount: Decimal
    balance_after: Decimal
    description: str
    reference_id: str | None
    created_at: datetime
