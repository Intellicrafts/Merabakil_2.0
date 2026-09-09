"""Saarthi conversation history — CRUD endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.db import get_session
from app.infrastructure.models import SaarthiConversation
from legalos_common.security.rbac import CurrentUser, get_current_user

router = APIRouter(prefix="/api/v1/conversations", tags=["conversations"])

MAX_CONVERSATIONS = 50


class ConversationUpsert(BaseModel):
    id: str
    title: str = "New Chat"
    messages: list = []
    document_id: str | None = None
    attached_documents: list = []
    draft_case_id: str | None = None
    jurisdiction: str | None = None
    matter_type: str | None = None
    pinned: bool = False
    created_at: str | None = None
    updated_at: str | None = None


class ConversationPatch(BaseModel):
    title: str | None = None
    pinned: bool | None = None
    jurisdiction: str | None = None
    matter_type: str | None = None
    draft_case_id: str | None = None
    messages: list | None = None
    attached_documents: list | None = None


def _to_dict(row: SaarthiConversation) -> dict:
    return {
        "id": str(row.id),
        "title": row.title,
        "messages": row.messages or [],
        "documentId": row.document_id,
        "attachedDocuments": row.attached_documents or [],
        "draftCaseId": row.draft_case_id,
        "jurisdiction": row.jurisdiction,
        "matterType": row.matter_type,
        "pinned": row.pinned,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("", summary="List the current user's Saarthi conversations")
async def list_conversations(
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    stmt = (
        select(SaarthiConversation)
        .where(SaarthiConversation.user_id == uuid.UUID(current_user.user_id))
        .order_by(SaarthiConversation.pinned.desc(), SaarthiConversation.updated_at.desc())
        .limit(MAX_CONVERSATIONS)
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return [_to_dict(r) for r in rows]


@router.post("", status_code=status.HTTP_200_OK, summary="Upsert a conversation")
async def upsert_conversation(
    body: ConversationUpsert,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    try:
        conv_id = uuid.UUID(body.id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation id")

    user_id = uuid.UUID(current_user.user_id)
    stmt = select(SaarthiConversation).where(
        SaarthiConversation.id == conv_id,
        SaarthiConversation.user_id == user_id,
    )
    row = (await session.execute(stmt)).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if row is None:
        row = SaarthiConversation(
            id=conv_id,
            user_id=user_id,
            title=body.title,
            messages=body.messages,
            document_id=body.document_id,
            attached_documents=body.attached_documents,
            draft_case_id=body.draft_case_id,
            jurisdiction=body.jurisdiction,
            matter_type=body.matter_type,
            pinned=body.pinned,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
    else:
        row.title = body.title
        row.messages = body.messages
        row.document_id = body.document_id
        row.attached_documents = body.attached_documents
        row.draft_case_id = body.draft_case_id
        row.jurisdiction = body.jurisdiction
        row.matter_type = body.matter_type
        row.pinned = body.pinned
        row.updated_at = now

    await session.flush()
    return _to_dict(row)


@router.put("/{conversation_id}", summary="Patch conversation metadata")
async def patch_conversation(
    conversation_id: uuid.UUID,
    body: ConversationPatch,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = select(SaarthiConversation).where(
        SaarthiConversation.id == conversation_id,
        SaarthiConversation.user_id == uuid.UUID(current_user.user_id),
    )
    row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if body.title is not None:
        row.title = body.title
    if body.pinned is not None:
        row.pinned = body.pinned
    if body.jurisdiction is not None:
        row.jurisdiction = body.jurisdiction
    if body.matter_type is not None:
        row.matter_type = body.matter_type
    if body.draft_case_id is not None:
        row.draft_case_id = body.draft_case_id
    if body.messages is not None:
        row.messages = body.messages
    if body.attached_documents is not None:
        row.attached_documents = body.attached_documents
    row.updated_at = datetime.now(timezone.utc)

    await session.flush()
    return _to_dict(row)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a conversation")
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    stmt = select(SaarthiConversation).where(
        SaarthiConversation.id == conversation_id,
        SaarthiConversation.user_id == uuid.UUID(current_user.user_id),
    )
    row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    await session.delete(row)
