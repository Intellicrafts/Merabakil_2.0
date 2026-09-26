"""Public JWT-authenticated wallet routes."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_wallet_service
from app.api.schemas import (
    AdminAdjustRequest,
    TopUpRequest,
    TransactionListResponse,
    WalletListResponse,
    WalletResponse,
    WalletTransactionOut,
)
from app.application.wallet_service import WalletService
from app.config import get_settings
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
    # Self top-up credits the wallet with no payment behind it. Keep it off until
    # a verified payment flow (gateway webhook) is wired in.
    if not get_settings().wallet_self_topup_enabled:
        raise HTTPException(status_code=403, detail="Wallet recharge is not available yet.")
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
    "/admin/wallets",
    response_model=WalletListResponse,
    summary="Admin: list all wallets",
    dependencies=[Depends(require_roles("admin"))],
)
async def admin_list_wallets(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    service: WalletService = Depends(get_wallet_service),
) -> WalletListResponse:
    wallets, total = await service.list_all_wallets(page=page, size=size)
    return WalletListResponse(
        items=[WalletResponse.from_entity(w.user_id, w.balance, w.currency) for w in wallets],
        total=total,
        page=page,
        size=size,
    )


@router.get(
    "/admin/{user_id}/transactions",
    response_model=TransactionListResponse,
    summary="Admin: list transactions for any user",
    dependencies=[Depends(require_roles("admin"))],
)
async def admin_list_user_transactions(
    user_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, ge=1, le=100),
    service: WalletService = Depends(get_wallet_service),
) -> TransactionListResponse:
    transactions, total = await service.list_transactions(user_id, page=page, size=size)
    return TransactionListResponse(
        items=[_tx_out(tx) for tx in transactions],
        total=total,
        page=page,
        size=size,
    )


@router.post(
    "/admin/{user_id}/adjust",
    response_model=WalletTransactionOut,
    summary="Admin: credit or debit a user's wallet",
    dependencies=[Depends(require_roles("admin"))],
)
async def admin_adjust_wallet(
    user_id: uuid.UUID,
    body: AdminAdjustRequest,
    service: WalletService = Depends(get_wallet_service),
) -> WalletTransactionOut:
    tx = await service.admin_adjust(
        user_id,
        amount=body.amount,
        adjust_type=body.type,
        reason=body.reason,
    )
    return _tx_out(tx)


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
