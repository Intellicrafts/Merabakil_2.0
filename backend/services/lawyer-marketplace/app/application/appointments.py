"""Appointment lifecycle — book, join window, expire, LiveKit token."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from jose import jwt

from app.constants import SUMMON_TTL_SECONDS, WINDOW_MINUTES
from app.infrastructure.appointment_models import Consultation
from app.infrastructure.appointment_repo import MarketplaceRepository
from app.infrastructure.lawyer_model import Lawyer

IST = ZoneInfo("Asia/Kolkata")
TERMINAL = frozenset({"cancelled", "completed", "expired", "no_show"})


def now_ist() -> datetime:
    return datetime.now(IST)


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=IST)
    return value.astimezone(IST)


def parse_slot(date_str: str, time_slot: str) -> datetime:
    slot = time_slot.strip()
    if slot.lower() in {"immediate", "now", "join now"}:
        return now_ist()
    if slot.lower() in {"in 1 minute", "now + 1 min", "demo", "start in 1 minute"}:
        return now_ist() + timedelta(minutes=1)
    parsed = datetime.strptime(f"{date_str} {slot}", "%Y-%m-%d %I:%M %p")
    return parsed.replace(tzinfo=IST)


def join_phase(row: Consultation, at: datetime | None = None) -> str:
    instant = _aware(at) or now_ist()
    start = _aware(row.scheduled_at)
    end = _aware(row.scheduled_end_at)
    if start is None or end is None:
        return "expired"
    if instant < start:
        return "upcoming"
    if instant <= end:
        return "joinable"
    return "expired"


def seconds_until_start(row: Consultation, at: datetime | None = None) -> int:
    instant = _aware(at) or now_ist()
    start = _aware(row.scheduled_at)
    if start is None:
        return 0
    return max(0, int((start - instant).total_seconds()))


def seconds_until_end(row: Consultation, at: datetime | None = None) -> int:
    instant = _aware(at) or now_ist()
    end = _aware(row.scheduled_end_at)
    if end is None:
        return 0
    return max(0, int((end - instant).total_seconds()))


def pending_summon(row: Consultation, user_id: uuid.UUID, at: datetime | None = None) -> bool:
    instant = _aware(at) or now_ist()
    stamped = _aware(row.last_summon_at)
    if row.summon_for_user_id != user_id or stamped is None:
        return False
    return (instant - stamped).total_seconds() <= SUMMON_TTL_SECONDS


async def refresh_status(repo: MarketplaceRepository, row: Consultation) -> Consultation:
    if row.status in TERMINAL:
        return row
    instant = now_ist()
    end = _aware(row.scheduled_end_at)
    if end and instant > end:
        citizen_on, lawyer_on = await repo.party_presence(row)
        if row.status == "live" and (citizen_on or lawyer_on):
            return row
        citizen = await repo.participant(row.id, row.citizen_user_id)
        lawyer = await repo.participant(row.id, row.lawyer_user_id)
        c_joins = citizen.join_count if citizen else 0
        l_joins = lawyer.join_count if lawyer else 0
        if c_joins and l_joins:
            row.status = "completed"
            row.completed_at = instant
        elif not c_joins and not l_joins:
            row.status = "no_show"
        else:
            row.status = "expired"
        row.expired_at = instant
        prior = row.metrics or {}
        row.metrics = {
            **prior,
            "message_count": await repo.message_count(row.id),
            "citizen_join_count": c_joins,
            "lawyer_join_count": l_joins,
            "talk_seconds": int(prior.get("talk_seconds") or 0),
        }
        await repo.add_event(row.id, "expired", None, {"status": row.status})
    return row


async def promote_live_if_active(repo: MarketplaceRepository, row: Consultation) -> bool:
    """Mark consultation live when parties are in-room during the join window."""
    if row.status in TERMINAL or row.status == "live":
        return False
    if join_phase(row) != "joinable":
        return False
    citizen_on, lawyer_on = await repo.party_presence(row)
    citizen = await repo.participant(row.id, row.citizen_user_id)
    lawyer = await repo.participant(row.id, row.lawyer_user_id)
    c_joins = citizen.join_count if citizen else 0
    l_joins = lawyer.join_count if lawyer else 0
    if not (citizen_on or lawyer_on or c_joins or l_joins):
        return False
    row.status = "live"
    if not getattr(row, "live_started_at", None):
        row.live_started_at = now_ist()
    await repo.add_event(row.id, "went_live", None, {"auto": True})
    return True


def auto_confirm() -> bool:
    return os.getenv("MARKETPLACE_AUTO_CONFIRM", "true").lower() in {"1", "true", "yes"}


async def book(
    repo: MarketplaceRepository,
    *,
    lawyer: Lawyer,
    client_id: uuid.UUID,
    client_name: str,
    date: str,
    time_slot: str,
    matter_summary: str,
    source: str,
) -> Consultation:
    start = parse_slot(date, time_slot)
    if start < now_ist() - timedelta(seconds=30):
        raise ValueError("Choose a future date and time slot.")
    if await repo.slot_taken(lawyer.id, start):
        raise ValueError("That slot is already booked with this counsel.")
    end = start + timedelta(minutes=WINDOW_MINUTES)
    status = "confirmed" if auto_confirm() and lawyer.is_verified else "requested"
    row = await repo.create_consultation(
        client_id=client_id,
        lawyer_id=lawyer.id,
        scheduled_at=start,
        scheduled_end_at=end,
        status=status,
        source=source if source in {"ai_match", "manual"} else "manual",
        matter_summary=matter_summary.strip(),
        time_slot=time_slot.strip(),
        confirmed_at=now_ist() if status == "confirmed" else None,
        livekit_room="",
        citizen_user_id=client_id,
        lawyer_user_id=lawyer.user_id,
        citizen_display_name=client_name,
        lawyer_display_name=lawyer.full_name,
        metrics={},
    )
    row.livekit_room = f"apt-{row.id}"
    await repo.add_event(row.id, "booked", client_id, {"source": row.source})
    if status == "confirmed":
        await repo.add_event(row.id, "confirmed", None, {"auto": True})
    return row


_TYPING: dict[tuple[str, str], datetime] = {}
_TYPING_TTL = 4


def set_typing(appointment_id: uuid.UUID, user_id: uuid.UUID, on: bool = True) -> None:
    key = (str(appointment_id), str(user_id))
    if on:
        _TYPING[key] = now_ist()
    else:
        _TYPING.pop(key, None)


def opponent_typing(appointment_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    instant = now_ist()
    expired = [
        key
        for key, stamped in _TYPING.items()
        if (instant - stamped).total_seconds() > _TYPING_TTL
    ]
    for key in expired:
        _TYPING.pop(key, None)
    aid = str(appointment_id)
    uid = str(user_id)
    return any(
        key[0] == aid and key[1] != uid and (instant - stamped).total_seconds() <= _TYPING_TTL
        for key, stamped in _TYPING.items()
    )


def mint_livekit_token(*, room: str, identity: str, name: str, role: str) -> dict:
    url = os.getenv("LIVEKIT_URL", "").strip()
    key = os.getenv("LIVEKIT_API_KEY", "").strip()
    secret = os.getenv("LIVEKIT_API_SECRET", "").strip()
    if not (url and key and secret):
        raise RuntimeError("LiveKit is not configured")
    now = int(datetime.now().timestamp())
    token = jwt.encode(
        {
            "iss": key,
            "sub": identity,
            "nbf": now - 10,
            "exp": now + 3600,
            "name": name,
            "metadata": role,
            "video": {
                "roomJoin": True,
                "room": room,
                "canPublish": True,
                "canSubscribe": True,
                "canPublishData": True,
            },
        },
        secret,
        algorithm="HS256",
    )
    return {"url": url, "token": token, "room": room}
