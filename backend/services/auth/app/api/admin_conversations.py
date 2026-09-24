"""Admin Saarthi conversation ops — cross-user read/write without schema changes."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.db import get_session
from app.infrastructure.models import SaarthiConversation, User
from legalos_common.api.pagination import Page, PageParams, paginate
from legalos_common.security.rbac import Permission, require_permissions

router = APIRouter(
    prefix="/api/v1/admin/conversations",
    tags=["admin-conversations"],
    dependencies=[Depends(require_permissions(Permission.USER_MANAGE.value))],
)


class AdminConversationPatch(BaseModel):
    title: str | None = None
    pinned: bool | None = None
    jurisdiction: str | None = None
    matter_type: str | None = None
    draft_case_id: str | None = None
    messages: list | None = None
    attached_documents: list | None = None


def _message_count(messages: list | None) -> int:
    return len(messages or [])


def _conversation_summary(row: SaarthiConversation, user: User | None = None) -> dict:
    out = {
        "id": str(row.id),
        "userId": str(row.user_id),
        "title": row.title,
        "messageCount": _message_count(row.messages),
        "pinned": row.pinned,
        "jurisdiction": row.jurisdiction,
        "matterType": row.matter_type,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }
    if user is not None:
        out["userEmail"] = user.email
        out["userName"] = user.full_name
        out["userRoles"] = user.role_names
    return out


def _conversation_detail(row: SaarthiConversation, user: User) -> dict:
    return {
        **_conversation_summary(row, user),
        "messages": row.messages or [],
        "documentId": row.document_id,
        "attachedDocuments": row.attached_documents or [],
        "draftCaseId": row.draft_case_id,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "fullName": user.full_name,
            "roles": user.role_names,
        },
    }


def _user_chat_summary(
    user: User,
    conversation_count: int,
    total_messages: int,
    last_activity: datetime | None,
) -> dict:
    return {
        "userId": str(user.id),
        "email": user.email,
        "fullName": user.full_name,
        "roles": user.role_names,
        "conversationCount": int(conversation_count or 0),
        "totalMessages": int(total_messages or 0),
        "lastActivity": last_activity.isoformat() if last_activity else None,
    }


@router.get("/stats", summary="Aggregate Saarthi chat stats")
async def chat_stats(
    session: AsyncSession = Depends(get_session),
) -> dict:
    msg_len = func.coalesce(func.jsonb_array_length(SaarthiConversation.messages), 0)
    agg = (
        await session.execute(
            select(
                func.count(func.distinct(SaarthiConversation.user_id)),
                func.count(SaarthiConversation.id),
                func.coalesce(func.sum(msg_len), 0),
            )
        )
    ).one()
    users_with_chats, total_conversations, total_messages = agg

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    rows = list(
        (await session.execute(select(SaarthiConversation.messages))).scalars().all()
    )
    messages_today = 0
    for messages in rows:
        for msg in messages or []:
            created_raw = msg.get("createdAt") or msg.get("created_at")
            if not created_raw:
                continue
            try:
                created = datetime.fromisoformat(str(created_raw).replace("Z", "+00:00"))
                if created >= today_start:
                    messages_today += 1
            except ValueError:
                continue

    return {
        "usersWithChats": int(users_with_chats or 0),
        "totalConversations": int(total_conversations or 0),
        "totalMessages": int(total_messages or 0),
        "messagesToday": messages_today,
    }


@router.get("/users", summary="List users with Saarthi chat stats")
async def list_chat_users(
    params: PageParams = Depends(PageParams.as_query),
    search: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> Page[dict]:
    msg_len = func.coalesce(func.jsonb_array_length(SaarthiConversation.messages), 0)

    base = (
        select(
            User,
            func.count(SaarthiConversation.id).label("conv_count"),
            func.coalesce(func.sum(msg_len), 0).label("msg_total"),
            func.max(SaarthiConversation.updated_at).label("last_activity"),
        )
        .join(SaarthiConversation, SaarthiConversation.user_id == User.id)
        .group_by(User.id)
    )

    if search:
        term = f"%{search.strip()}%"
        base = base.where(or_(User.email.ilike(term), User.full_name.ilike(term)))

    count_stmt = select(func.count()).select_from(base.subquery())
    total = int((await session.execute(count_stmt)).scalar_one())

    rows = (
        await session.execute(
            base.order_by(func.max(SaarthiConversation.updated_at).desc())
            .offset(params.offset)
            .limit(params.size)
        )
    ).all()

    user_ids = [user.id for user, *_ in rows]
    role_map: dict[uuid.UUID, User] = {}
    if user_ids:
        role_rows = (
            await session.execute(
                select(User).where(User.id.in_(user_ids)).options(selectinload(User.roles))
            )
        ).scalars().all()
        role_map = {u.id: u for u in role_rows}

    items = [
        _user_chat_summary(role_map.get(user.id, user), conv_count, msg_total, last_activity)
        for user, conv_count, msg_total, last_activity in rows
    ]
    return paginate(items, total, params)


@router.get("", summary="List all Saarthi conversations (admin)")
async def list_all_conversations(
    params: PageParams = Depends(PageParams.as_query),
    search: str | None = Query(default=None),
    user_id: uuid.UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
) -> Page[dict]:
    stmt = (
        select(SaarthiConversation, User)
        .join(User, User.id == SaarthiConversation.user_id)
        .options(selectinload(User.roles))
    )

    if user_id is not None:
        stmt = stmt.where(SaarthiConversation.user_id == user_id)

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                SaarthiConversation.title.ilike(term),
                User.email.ilike(term),
                User.full_name.ilike(term),
            )
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = int((await session.execute(count_stmt)).scalar_one())

    rows = (
        await session.execute(
            stmt.order_by(SaarthiConversation.updated_at.desc())
            .offset(params.offset)
            .limit(params.size)
        )
    ).all()

    items = [_conversation_summary(conv, user) for conv, user in rows]
    return paginate(items, total, params)


@router.get("/users/{user_id}", summary="List conversations for a user")
async def list_user_conversations(
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    user_stmt = select(User).where(User.id == user_id).options(selectinload(User.roles))
    user = (await session.execute(user_stmt)).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    stmt = (
        select(SaarthiConversation)
        .where(SaarthiConversation.user_id == user_id)
        .order_by(SaarthiConversation.pinned.desc(), SaarthiConversation.updated_at.desc())
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return [_conversation_summary(r, user) for r in rows]


@router.get("/{conversation_id}", summary="Get conversation detail")
async def get_conversation(
    conversation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = (
        select(SaarthiConversation, User)
        .join(User, User.id == SaarthiConversation.user_id)
        .where(SaarthiConversation.id == conversation_id)
        .options(selectinload(User.roles))
    )
    row = (await session.execute(stmt)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv, user = row
    return _conversation_detail(conv, user)


@router.put("/{conversation_id}", summary="Admin patch conversation")
async def patch_conversation(
    conversation_id: uuid.UUID,
    body: AdminConversationPatch,
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = (
        select(SaarthiConversation, User)
        .join(User, User.id == SaarthiConversation.user_id)
        .where(SaarthiConversation.id == conversation_id)
        .options(selectinload(User.roles))
    )
    row = (await session.execute(stmt)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv, user = row

    updates = body.model_dump(exclude_unset=True)
    if "title" in updates:
        conv.title = updates["title"]
    if "pinned" in updates:
        conv.pinned = updates["pinned"]
    if "jurisdiction" in updates:
        conv.jurisdiction = updates["jurisdiction"]
    if "matter_type" in updates:
        conv.matter_type = updates["matter_type"]
    if "draft_case_id" in updates:
        conv.draft_case_id = updates["draft_case_id"]
    if "messages" in updates:
        conv.messages = updates["messages"]
    if "attached_documents" in updates:
        conv.attached_documents = updates["attached_documents"]
    conv.updated_at = datetime.now(timezone.utc)

    await session.flush()
    return _conversation_detail(conv, user)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete conversation")
async def delete_conversation(
    conversation_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> None:
    stmt = select(SaarthiConversation).where(SaarthiConversation.id == conversation_id)
    row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await session.delete(row)
