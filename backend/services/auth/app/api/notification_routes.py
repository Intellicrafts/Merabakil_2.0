"""Notification read/manage endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import NotificationOut
from app.infrastructure.db import get_session
from app.infrastructure.models import Notification
from legalos_common.security.rbac import CurrentUser, get_current_user

notifications_router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


def _to_out(n: Notification) -> NotificationOut:
    return NotificationOut(
        id=str(n.id),
        kind=n.kind,
        title=n.title,
        body=n.body,
        action_url=n.action_url,
        is_read=n.is_read,
        created_at=n.created_at,
    )


@notifications_router.get("", response_model=list[NotificationOut])
async def list_notifications(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[NotificationOut]:
    uid = uuid.UUID(user.user_id)
    result = await session.execute(
        select(Notification)
        .where(Notification.user_id == uid)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return [_to_out(n) for n in result.scalars().all()]


@notifications_router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NotificationOut:
    uid = uuid.UUID(user.user_id)
    await session.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == uid)
        .values(is_read=True)
    )
    await session.commit()
    result = await session.execute(
        select(Notification).where(Notification.id == notification_id)
    )
    n = result.scalar_one()
    return _to_out(n)


@notifications_router.post("/mark-all-read")
async def mark_all_notifications_read(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    uid = uuid.UUID(user.user_id)
    await session.execute(
        update(Notification)
        .where(Notification.user_id == uid, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await session.commit()
    return {"ok": True}
