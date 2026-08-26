"""Internal service-to-service wallet routes (no JWT; X-Internal-Secret header)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi import Request

from app.api.deps import get_wallet_service
from app.api.schemas import (
    InternalCreditRequest,
    InternalDeductRequest,
    InternalTransactionResponse,
)
from app.application.wallet_service import InsufficientFundsError, WalletService
from app.config import get_settings

_settings = get_settings()

internal_router = APIRouter(prefix="/internal/wallet", tags=["internal"])


async def _verify_secret(x_internal_secret: str = Header(...)) -> None:
    if x_internal_secret != _settings.billing_internal_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@internal_router.post(
    "/deduct",
    response_model=InternalTransactionResponse,
    dependencies=[Depends(_verify_secret)],
    summary="Internal: debit a user's wallet",
)
async def internal_deduct(
    body: InternalDeductRequest,
    service: WalletService = Depends(get_wallet_service),
) -> InternalTransactionResponse:
    try:
        tx = await service.deduct(
            body.user_id,
            amount=body.amount,
            transaction_type=body.transaction_type,
            description=body.description,
            reference_id=body.reference_id,
        )
    except InsufficientFundsError as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=exc.message) from exc
    return InternalTransactionResponse(
        transaction_id=str(tx.id),
        user_id=str(tx.user_id),
        balance_after=str(tx.balance_after),
    )


@internal_router.post(
    "/credit",
    response_model=InternalTransactionResponse,
    dependencies=[Depends(_verify_secret)],
    summary="Internal: credit a user's wallet",
)
async def internal_credit(
    body: InternalCreditRequest,
    service: WalletService = Depends(get_wallet_service),
) -> InternalTransactionResponse:
    tx = await service.credit(
        body.user_id,
        amount=body.amount,
        transaction_type=body.transaction_type,
        description=body.description,
        reference_id=body.reference_id,
    )
    return InternalTransactionResponse(
        transaction_id=str(tx.id),
        user_id=str(tx.user_id),
        balance_after=str(tx.balance_after),
    )
