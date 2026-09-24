"""Admin Saarthi conversations for native dev — JSON file store, no Postgres."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from dev_conversations import STATE_FILE, _load_store, _save_store, _to_dict
from legalos_common.api.pagination import Page, PageParams, paginate
from legalos_common.security.rbac import Permission, require_permissions

AUTH_STATE_FILE = Path(__file__).resolve().parents[2] / "data" / ".dev-auth-state.json"

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


def _load_users() -> dict[str, dict]:
    if not AUTH_STATE_FILE.is_file():
        return {}
    try:
        raw = json.loads(AUTH_STATE_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    users: dict[str, dict] = {}
    for entry in raw.get("users", []):
        users[entry["id"]] = {
            "id": entry["id"],
            "email": entry["email"],
            "fullName": entry["full_name"],
            "roles": [r["name"] for r in entry.get("roles_data", [])],
        }
    return users


def _message_count(row: dict) -> int:
    return len(row.get("messages") or [])


def _find_conversation(store: dict, conversation_id: str) -> tuple[str, dict] | None:
    for user_id, convs in store.items():
        if conversation_id in convs:
            return user_id, convs[conversation_id]
    return None


def _user_info(user_id: str) -> dict:
    users = _load_users()
    user = users.get(user_id)
    if user is None:
        return {
            "id": user_id,
            "email": "unknown@local.dev",
            "fullName": "Unknown user",
            "roles": [],
        }
    return user


def _conversation_summary(row: dict, user_id: str) -> dict:
    user = _user_info(user_id)
    return {
        **_to_dict(row),
        "userId": user_id,
        "userEmail": user["email"],
        "userName": user["fullName"],
        "userRoles": user["roles"],
        "messageCount": _message_count(row),
    }


def _conversation_detail(row: dict, user_id: str) -> dict:
    user = _user_info(user_id)
    return {
        **_conversation_summary(row, user_id),
        "user": user,
    }


def _user_chat_summary(user_id: str, conversations: dict[str, dict]) -> dict:
    user = _user_info(user_id)
    conv_list = list(conversations.values())
    total_messages = sum(_message_count(c) for c in conv_list)
    last_activity = max((c.get("updated_at") or "") for c in conv_list) if conv_list else None
    return {
        "userId": user_id,
        "email": user["email"],
        "fullName": user["fullName"],
        "roles": user["roles"],
        "conversationCount": len(conv_list),
        "totalMessages": total_messages,
        "lastActivity": last_activity or None,
    }


def _iter_all_conversations(store: dict) -> list[tuple[str, dict]]:
    rows: list[tuple[str, dict]] = []
    for user_id, convs in store.items():
        for conv in convs.values():
            rows.append((user_id, conv))
    rows.sort(key=lambda item: item[1].get("updated_at") or "", reverse=True)
    return rows


@router.get("/stats", summary="Aggregate Saarthi chat stats")
async def chat_stats() -> dict:
    store = _load_store()
    all_rows = _iter_all_conversations(store)
    today = datetime.now(timezone.utc).date().isoformat()
    messages_today = 0
    total_messages = 0
    for _, conv in all_rows:
        for msg in conv.get("messages") or []:
            total_messages += 1
            created = msg.get("createdAt") or msg.get("created_at") or ""
            if created.startswith(today):
                messages_today += 1
    return {
        "usersWithChats": len(store),
        "totalConversations": len(all_rows),
        "totalMessages": total_messages,
        "messagesToday": messages_today,
    }


@router.get("/users", summary="List users with Saarthi chat stats")
async def list_chat_users(
    params: PageParams = Depends(PageParams.as_query),
    search: str | None = Query(default=None),
) -> Page[dict]:
    store = _load_store()
    summaries = [_user_chat_summary(user_id, convs) for user_id, convs in store.items() if convs]

    if search:
        term = search.strip().lower()
        summaries = [
            s
            for s in summaries
            if term in s["email"].lower() or term in s["fullName"].lower()
        ]

    summaries.sort(key=lambda s: s.get("lastActivity") or "", reverse=True)
    total = len(summaries)
    items = summaries[params.offset : params.offset + params.size]
    return paginate(items, total, params)


@router.get("", summary="List all Saarthi conversations (admin)")
async def list_all_conversations(
    params: PageParams = Depends(PageParams.as_query),
    search: str | None = Query(default=None),
    user_id: uuid.UUID | None = Query(default=None),
) -> Page[dict]:
    store = _load_store()
    rows = _iter_all_conversations(store)

    if user_id is not None:
        uid = str(user_id)
        rows = [(u, conv) for u, conv in rows if u == uid]

    if search:
        term = search.strip().lower()
        filtered: list[tuple[str, dict]] = []
        for uid, conv in rows:
            user = _user_info(uid)
            haystack = " ".join(
                [
                    conv.get("title") or "",
                    user["email"],
                    user["fullName"],
                ]
            ).lower()
            if term in haystack:
                filtered.append((uid, conv))
        rows = filtered

    total = len(rows)
    page_rows = rows[params.offset : params.offset + params.size]
    items = [_conversation_summary(conv, uid) for uid, conv in page_rows]
    return paginate(items, total, params)


@router.get("/users/{user_id}", summary="List conversations for a user")
async def list_user_conversations(user_id: uuid.UUID) -> list[dict]:
    uid = str(user_id)
    store = _load_store()
    if uid not in store and uid not in _load_users():
        raise HTTPException(status_code=404, detail="User not found")

    convs = store.get(uid, {})
    rows = list(convs.values())
    rows.sort(key=lambda r: r.get("updated_at") or "", reverse=True)
    rows.sort(key=lambda r: bool(r.get("pinned", False)), reverse=True)
    return [_conversation_summary(r, uid) for r in rows]


@router.get("/{conversation_id}", summary="Get conversation detail")
async def get_conversation(conversation_id: uuid.UUID) -> dict:
    store = _load_store()
    found = _find_conversation(store, str(conversation_id))
    if found is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    user_id, row = found
    return _conversation_detail(row, user_id)


@router.put("/{conversation_id}", summary="Admin patch conversation")
async def patch_conversation(conversation_id: uuid.UUID, body: AdminConversationPatch) -> dict:
    conv_id = str(conversation_id)
    store = _load_store()
    found = _find_conversation(store, conv_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    user_id, row = found

    updates = body.model_dump(exclude_unset=True)
    if "title" in updates:
        row["title"] = updates["title"]
    if "pinned" in updates:
        row["pinned"] = updates["pinned"]
    if "jurisdiction" in updates:
        row["jurisdiction"] = updates["jurisdiction"]
    if "matter_type" in updates:
        row["matter_type"] = updates["matter_type"]
    if "draft_case_id" in updates:
        row["draft_case_id"] = updates["draft_case_id"]
    if "messages" in updates:
        row["messages"] = updates["messages"]
    if "attached_documents" in updates:
        row["attached_documents"] = updates["attached_documents"]
    row["updated_at"] = datetime.now(timezone.utc).isoformat()

    _save_store(store)
    return _conversation_detail(row, user_id)


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete conversation")
async def delete_conversation(conversation_id: uuid.UUID) -> None:
    conv_id = str(conversation_id)
    store = _load_store()
    found = _find_conversation(store, conv_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    user_id, _ = found
    del store[user_id][conv_id]
    if not store[user_id]:
        del store[user_id]
    _save_store(store)
