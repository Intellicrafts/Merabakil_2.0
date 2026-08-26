"""Public JWT-authenticated wallet routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_wallet_service
from app.api.schemas import (
    TopUpRequest,
    TransactionListResponse,
    WalletResponse,
    WalletTransactionOut,
)
from app.application.wallet_service import WalletService
from legalos_common.security.rbac import CurrentUser, get_current_user, require_roles

router = APIRouter(prefix="/api/v1/wallet", tags=["wallet"])


def _tx_out(tx) -> WalletTransactionOut:
    return WalletTransactionOut(
        id=str(tx.id),
        wallet_id=str(tx.wallet_id),
        user_id=str(tx.user_id),
        transaction_type=tx.transaction_type.value,
        amount=str(tx.amount),
        balance_after=str(tx.balance_after),
        description=tx.description,
        reference_id=tx.reference_id,
        created_at=tx.created_at.isoformat(),
    )


@router.get("/me", response_model=WalletResponse, summary="Get own wallet balance")
async def get_my_wallet(
    user: CurrentUser = Depends(get_current_user),
    service: WalletService = Depends(get_wallet_service),
) -> WalletResponse:
    wallet = await service.get_or_create(uuid.UUID(user.user_id))
    return WalletResponse.from_entity(wallet.user_id, wallet.balance, wallet.currency)


@router.post("/me/top-up", response_model=WalletTransactionOut, summary="Add funds to wallet")
async def top_up(
    body: TopUpRequest,
    user: CurrentUser = Depends(get_current_user),
    service: WalletService = Depends(get_wallet_service),
) -> WalletTransactionOut:
    tx = await service.top_up(
        uuid.UUID(user.user_id),
        amount=body.amount,
        description=body.description,
    )
    return _tx_out(tx)


@router.get(
    "/me/transactions",
    response_model=TransactionListResponse,
    summary="List own transaction history",
)
async def list_my_transactions(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    service: WalletService = Depends(get_wallet_service),
) -> TransactionListResponse:
    transactions, total = await service.list_transactions(
        uuid.UUID(user.user_id), page=page, size=size
    )
    return TransactionListResponse(
        items=[_tx_out(tx) for tx in transactions],
        total=total,
        page=page,
        size=size,
    )


@router.get(
    "/{user_id}",
    response_model=WalletResponse,
    summary="Admin: inspect any user's wallet",
    dependencies=[Depends(require_roles("admin"))],
)
async def get_user_wallet(
    user_id: uuid.UUID,
    service: WalletService = Depends(get_wallet_service),
) -> WalletResponse:
    wallet = await service.get_or_create(user_id)
    return WalletResponse.from_entity(wallet.user_id, wallet.balance, wallet.currency)
