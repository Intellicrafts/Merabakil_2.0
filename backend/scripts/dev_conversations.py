"""Saarthi conversations for native dev — JSON file store, no Postgres."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from legalos_common.security.rbac import CurrentUser, get_current_user

MAX_CONVERSATIONS = 50
STATE_FILE = Path(__file__).resolve().parents[2] / "data" / ".dev-conversations.json"

router = APIRouter(prefix="/api/v1/conversations", tags=["conversations"])


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


def _load_store() -> dict[str, dict[str, dict]]:
    if not STATE_FILE.is_file():
        return {}
    try:
        raw = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return raw if isinstance(raw, dict) else {}


def _save_store(store: dict[str, dict[str, dict]]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(store, indent=2), encoding="utf-8")


def _to_dict(row: dict) -> dict:
    return {
        "id": row["id"],
        "title": row.get("title", "New Chat"),
        "messages": row.get("messages") or [],
        "documentId": row.get("document_id"),
        "attachedDocuments": row.get("attached_documents") or [],
        "draftCaseId": row.get("draft_case_id"),
        "jurisdiction": row.get("jurisdiction"),
        "matterType": row.get("matter_type"),
        "pinned": bool(row.get("pinned", False)),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _user_conversations(store: dict[str, dict[str, dict]], user_id: str) -> dict[str, dict]:
    return store.setdefault(user_id, {})


@router.get("", summary="List the current user's Saarthi conversations")
async def list_conversations(
    current_user: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    store = _load_store()
    rows = list(_user_conversations(store, current_user.user_id).values())
    rows.sort(key=lambda r: r.get("updated_at") or "", reverse=True)
    rows.sort(key=lambda r: bool(r.get("pinned", False)), reverse=True)
    return [_to_dict(r) for r in rows[:MAX_CONVERSATIONS]]


@router.post("", status_code=status.HTTP_200_OK, summary="Upsert a conversation")
async def upsert_conversation(
    body: ConversationUpsert,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    try:
        conv_id = str(uuid.UUID(body.id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid conversation id")

    store = _load_store()
    user_rows = _user_conversations(store, current_user.user_id)
    now = datetime.now(timezone.utc).isoformat()
    existing = user_rows.get(conv_id)

    if existing is None:
        user_rows[conv_id] = {
            "id": conv_id,
            "title": body.title,
            "messages": body.messages,
            "document_id": body.document_id,
            "attached_documents": body.attached_documents,
            "draft_case_id": body.draft_case_id,
            "jurisdiction": body.jurisdiction,
            "matter_type": body.matter_type,
            "pinned": body.pinned,
            "created_at": body.created_at or now,
            "updated_at": body.updated_at or now,
        }
    else:
        existing.update(
            {
                "title": body.title,
                "messages": body.messages,
                "document_id": body.document_id,
                "attached_documents": body.attached_documents,
                "draft_case_id": body.draft_case_id,
                "jurisdiction": body.jurisdiction,
                "matter_type": body.matter_type,
                "pinned": body.pinned,
                "updated_at": now,
            }
        )

    _save_store(store)
    return _to_dict(user_rows[conv_id])


@router.put("/{conversation_id}", summary="Patch conversation metadata")
async def patch_conversation(
    conversation_id: uuid.UUID,
    body: ConversationPatch,
    current_user: CurrentUser = Depends(get_current_user),
) -> dict:
    conv_id = str(conversation_id)
    store = _load_store()
    user_rows = _user_conversations(store, current_user.user_id)
    row = user_rows.get(conv_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if body.title is not None:
        row["title"] = body.title
    if body.pinned is not None:
        row["pinned"] = body.pinned
    if body.jurisdiction is not None:
        row["jurisdiction"] = body.jurisdiction
    if body.matter_type is not None:
        row["matter_type"] = body.matter_type
    if body.draft_case_id is not None:
        row["draft_case_id"] = body.draft_case_id
    if body.messages is not None:
        row["messages"] = body.messages
    if body.attached_documents is not None:
        row["attached_documents"] = body.attached_documents
    row["updated_at"] = datetime.now(timezone.utc).isoformat()

    _save_store(store)
    return _to_dict(row)


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a conversation",
)
async def delete_conversation(
    conversation_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    conv_id = str(conversation_id)
    store = _load_store()
    user_rows = _user_conversations(store, current_user.user_id)
    if conv_id not in user_rows:
        raise HTTPException(status_code=404, detail="Conversation not found")
    del user_rows[conv_id]
    _save_store(store)
