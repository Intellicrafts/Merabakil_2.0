"""Appointment lifecycle — book, join window, expire, LiveKit token."""

from __future__ import annotations

import os
import uuid
from dataclasses import dataclass, field
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


CALL_RING_TTL_SECONDS = 60


@dataclass
class CallSession:
    call_id: str
    appointment_id: str
    caller_id: str
    target_id: str
    mode: str
    status: str
    caller_name: str
    started_at: datetime = field(default_factory=now_ist)


_ACTIVE_CALLS: dict[str, CallSession] = {}


def _purge_expired_calls() -> None:
    instant = now_ist()
    expired = [
        aid
        for aid, session in _ACTIVE_CALLS.items()
        if session.status == "ringing"
        and (instant - _aware(session.started_at)).total_seconds() > CALL_RING_TTL_SECONDS
    ]
    for aid in expired:
        _ACTIVE_CALLS.pop(aid, None)


def start_ring(
    *,
    appointment_id: uuid.UUID,
    caller_id: uuid.UUID,
    target_id: uuid.UUID,
    mode: str,
    caller_name: str,
) -> CallSession:
    _purge_expired_calls()
    aid = str(appointment_id)
    existing = _ACTIVE_CALLS.get(aid)
    if existing and existing.status in {"ringing", "accepted"}:
        raise ValueError("A call is already active for this appointment.")
    session = CallSession(
        call_id=str(uuid.uuid4()),
        appointment_id=aid,
        caller_id=str(caller_id),
        target_id=str(target_id),
        mode=mode,
        status="ringing",
        caller_name=caller_name,
    )
    _ACTIVE_CALLS[aid] = session
    return session


def get_active_call(appointment_id: uuid.UUID) -> CallSession | None:
    _purge_expired_calls()
    return _ACTIVE_CALLS.get(str(appointment_id))


def pending_incoming_call(appointment_id: uuid.UUID, user_id: uuid.UUID) -> dict | None:
    session = get_active_call(appointment_id)
    if not session or session.status != "ringing" or session.target_id != str(user_id):
        return None
    return call_payload(session)


def call_payload(session: CallSession) -> dict:
    return {
        "call_id": session.call_id,
        "appointment_id": session.appointment_id,
        "mode": session.mode,
        "caller_user_id": session.caller_id,
        "caller_name": session.caller_name,
        "started_at": _aware(session.started_at).isoformat() if session.started_at else None,
        "status": session.status,
    }


def accept_call(appointment_id: uuid.UUID, call_id: str, user_id: uuid.UUID) -> CallSession:
    session = get_active_call(appointment_id)
    if not session or session.call_id != call_id:
        raise ValueError("Call not found.")
    if session.target_id != str(user_id):
        raise ValueError("Not the call recipient.")
    if session.status != "ringing":
        raise ValueError("Call is no longer ringing.")
    session.status = "accepted"
    return session


def decline_call(appointment_id: uuid.UUID, call_id: str, user_id: uuid.UUID) -> CallSession:
    session = get_active_call(appointment_id)
    if not session or session.call_id != call_id:
        raise ValueError("Call not found.")
    if session.target_id != str(user_id):
        raise ValueError("Not the call recipient.")
    if session.status != "ringing":
        raise ValueError("Call is no longer ringing.")
    session.status = "declined"
    _ACTIVE_CALLS.pop(str(appointment_id), None)
    return session


def cancel_call(appointment_id: uuid.UUID, call_id: str, user_id: uuid.UUID) -> CallSession:
    session = get_active_call(appointment_id)
    if not session or session.call_id != call_id:
        raise ValueError("Call not found.")
    if session.caller_id != str(user_id):
        raise ValueError("Only the caller can cancel.")
    if session.status != "ringing":
        raise ValueError("Call is no longer ringing.")
    session.status = "cancelled"
    _ACTIVE_CALLS.pop(str(appointment_id), None)
    return session


def end_call(appointment_id: uuid.UUID) -> CallSession | None:
    session = _ACTIVE_CALLS.pop(str(appointment_id), None)
    if session:
        session.status = "ended"
    return session


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
