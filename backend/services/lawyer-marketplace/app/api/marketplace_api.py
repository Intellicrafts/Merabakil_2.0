"""JWT-protected lawyer listing and appointment APIs."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    ActivityLogOut,
    ActivityLogPageOut,
    AdminEventOut,
    AdminLawyerPatch,
    AppointmentOut,
    AttachmentOut,
    BookAppointmentRequest,
    CallCancelRequest,
    CallEventRequest,
    CallRespondRequest,
    CallRingRequest,
    DurationRequest,
    EmergencyRequest,
    ExtendRequest,
    IncomingCallPayload,
    JoinStateOut,
    LawyerMeUpdate,
    LawyerPublic,
    MatchRequest,
    MessageOut,
    ModerateKickRequest,
    ModerateSuspendRequest,
    ModerateUnsuspendRequest,
    ParticipantModeration,
    PartyHealthOut,
    PostMessageRequest,
    PriorityRequest,
    ReactionRequest,
    ReasonRequest,
    ReassignRequest,
    RoomTokenOut,
    SessionHealthOut,
    SystemMessageRequest,
    TranscriptOut,
    TypingRequest,
)
from app.application.summary import LawyerSummaryGenerator
from app.infrastructure.lawyer_vector_store import get_lawyer_vector_store
from app.application.appointments import (
    _ACTIVE_CALLS,
    accept_call,
    book,
    call_payload,
    cancel_call,
    decline_call,
    end_call,
    get_active_call,
    join_phase,
    now_ist,
    opponent_typing,
    pending_incoming_call,
    pending_summon,
    promote_live_if_active,
    refresh_status,
    seconds_until_end,
    seconds_until_start,
    set_typing,
    start_ring,
)
from app.application.livekit_tokens import (
    list_room_participants,
    livekit_configured,
    mint_observe_token,
    mint_room_token,
    remove_room_participant,
)
from app.application.matching import score_lawyer
from app.application.room_hub import publish, publish_admin, publish_user, subscribe, subscribe_admin, subscribe_user, unsubscribe, unsubscribe_admin, unsubscribe_user
from app.constants import EMERGENCY_STATUSES, PRIORITIES, SUMMON_TTL_SECONDS
from app.infrastructure.appointment_models import AppointmentParticipant, Consultation, Notification
from app.infrastructure.appointment_repo import MarketplaceRepository
from app.infrastructure.db import get_session, session_scope
from app.infrastructure.file_store import (
    AUDIO_KINDS,
    IMAGE_KINDS,
    infer_kind,
    resolve_path,
    validate_upload,
    write_bytes,
)
from app.infrastructure.lawyer_model import Lawyer
from legalos_common.clients.llm import build_llm_client
from legalos_common.config import get_common_settings
from legalos_common.security.rbac import CurrentUser, Role, get_current_user, require_roles

logger = logging.getLogger(__name__)

_common_settings = get_common_settings()
_llm = build_llm_client(_common_settings.llm)
_summary_generator = LawyerSummaryGenerator(_llm)

from app.infrastructure.billing_client import BillingClient  # noqa: E402
from legalos_common.email.client import AsyncEmailClient  # noqa: E402
from legalos_common.email.templates import (  # noqa: E402
    appointment_cancelled_email,
    appointment_confirmed_email,
    appointment_rejected_email,
    booking_created_email,
)
_billing = BillingClient(
    _common_settings.billing_service_url,
    _common_settings.billing_internal_secret,
)
_email = AsyncEmailClient(_common_settings.smtp)


async def _get_user_email(session: AsyncSession, user_id: uuid.UUID) -> tuple[str | None, str | None]:
    from sqlalchemy import text

    try:
        result = await session.execute(
            text("SELECT email, full_name FROM users WHERE id = :uid"), {"uid": user_id}
        )
        row = result.fetchone()
        return (row[0], row[1]) if row else (None, None)
    except Exception:
        return (None, None)


def _is_indexable(lawyer: Lawyer) -> bool:
    """Profile is complete enough to generate an AI summary and index for matching."""
    return bool(
        lawyer.practice_areas
        and (lawyer.years_experience or 0) > 0
        and lawyer.bio
        and len(lawyer.bio) >= 50
    )


async def _generate_and_index(lawyer_id: uuid.UUID) -> None:
    """Background task: generate LLM summary, persist it, then index into Qdrant."""
    try:
        async with session_scope() as bg_session:
            repo = MarketplaceRepository(bg_session)
            lawyer = await repo.get_lawyer(lawyer_id)
            if lawyer is None:
                return
            summary = await _summary_generator.generate(lawyer)
            lawyer.summary = summary
            # session_scope commits on exit

        logger.info("lawyer_summary_generated lawyer_id=%s", lawyer_id)

        # Re-fetch with fresh session so Qdrant sees the committed summary
        async with session_scope() as idx_session:
            repo = MarketplaceRepository(idx_session)
            lawyer = await repo.get_lawyer(lawyer_id)
            if lawyer:
                await get_lawyer_vector_store().upsert(lawyer)

    except Exception as exc:
        logger.warning("lawyer_summary_failed lawyer_id=%s error=%s", lawyer_id, exc)

lawyers_router = APIRouter(prefix="/api/v1/lawyers", tags=["lawyers"])
appointments_router = APIRouter(prefix="/api/v1/appointments", tags=["appointments"])
admin_router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(require_roles("admin"))])


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _lawyer_public(lawyer: Lawyer, *, match_score: int = 0, recommended: bool = False) -> LawyerPublic:
    return LawyerPublic(
        id=str(lawyer.id),
        slug=lawyer.slug,
        user_id=str(lawyer.user_id),
        full_name=lawyer.full_name,
        bar_council_id=lawyer.bar_council_id,
        practice_areas=list(lawyer.practice_areas or []),
        city=lawyer.city or "",
        jurisdictions=list(lawyer.jurisdictions or []),
        languages=list(lawyer.languages or []),
        years_experience=lawyer.years_experience,
        rating=float(lawyer.rating or 0),
        rating_count=lawyer.rating_count,
        hourly_rate=float(lawyer.hourly_rate) if lawyer.hourly_rate is not None else None,
        is_verified=lawyer.is_verified,
        bio=lawyer.bio or "",
        summary=lawyer.summary or lawyer.bio or "",
        match_score=match_score,
        ai_recommended=recommended,
    )


def _role_for(user: CurrentUser, row: Consultation) -> str:
    if user.user_id == str(row.lawyer_user_id):
        return "lawyer"
    if user.has_role("admin") and user.user_id not in {str(row.client_id), str(row.citizen_user_id)}:
        return "admin"
    return "citizen"


def _is_participant(user: CurrentUser, row: Consultation) -> bool:
    return user.user_id in {str(row.client_id), str(row.lawyer_user_id)} or user.has_role("admin")


def _aware_ist(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=now_ist().tzinfo)
    return value.astimezone(now_ist().tzinfo)


def _participant_blocked(part: AppointmentParticipant | None) -> tuple[bool, str]:
    if part is None:
        return False, ""
    status = getattr(part, "moderation_status", None) or "none"
    if status == "kicked":
        return True, "You were removed by platform operations. An administrator must allow you to rejoin."
    if status == "suspended":
        return True, "You are suspended from this conference until an administrator allows you to rejoin."
    return False, ""


def _is_active_suspend(part: AppointmentParticipant | None) -> bool:
    if part is None:
        return False
    return getattr(part, "moderation_status", None) == "suspended"


async def _require_participant_active(
    repo: MarketplaceRepository, row: Consultation, user_id: uuid.UUID
) -> None:
    part = await repo.participant(row.id, user_id)
    blocked, detail = _participant_blocked(part)
    if blocked:
        raise HTTPException(status_code=403, detail=detail)


def _moderation_out(part: AppointmentParticipant | None) -> ParticipantModeration:
    if part is None:
        return ParticipantModeration()
    status = getattr(part, "moderation_status", None) or "none"
    until = _aware_ist(getattr(part, "suspended_until", None))
    return ParticipantModeration(
        status=status,
        suspended_until=_iso(until) if status == "suspended" else None,
        reason=getattr(part, "moderation_reason", None) or "",
    )


def _target_party(row: Consultation, target: str) -> tuple[uuid.UUID, str, str]:
    if target == "lawyer":
        return row.lawyer_user_id, "lawyer", row.lawyer_display_name or "Counsel"
    return row.citizen_user_id, "citizen", row.citizen_display_name or "Citizen"


async def _to_appointment(
    repo: MarketplaceRepository,
    row: Consultation,
    user: CurrentUser,
    *,
    lawyer: Lawyer | None = None,
) -> AppointmentOut:
    await refresh_status(repo, row)
    phase = join_phase(row)
    uid = uuid.UUID(user.user_id)
    counterpart = (
        row.citizen_display_name
        if user.user_id == str(row.lawyer_user_id)
        else row.lawyer_display_name
    )
    slug = lawyer.slug if lawyer else None
    citizen_on, lawyer_on = await repo.party_presence(row)
    parties = await repo.party_participants(row)
    return AppointmentOut(
        id=str(row.id),
        lawyer_id=str(row.lawyer_id),
        lawyer_name=row.lawyer_display_name,
        lawyer_slug=slug,
        citizen_user_id=str(row.citizen_user_id),
        lawyer_user_id=str(row.lawyer_user_id),
        citizen_name=row.citizen_display_name,
        counterpart_name=counterpart,
        my_role=_role_for(user, row),
        livekit_room=row.livekit_room or f"apt-{row.id}",
        date=row.scheduled_at.date().isoformat() if row.scheduled_at else "",
        time_slot=row.time_slot,
        scheduled_at=_iso(row.scheduled_at),
        scheduled_end_at=_iso(row.scheduled_end_at),
        matter_summary=row.matter_summary,
        status=row.status,
        source=row.source,
        join_state=phase,
        seconds_until_start=seconds_until_start(row),
        seconds_until_end=seconds_until_end(row),
        opponent_present=await repo.opponent_present(row.id, uid),
        pending_summon=pending_summon(row, uid),
        created_at=_iso(row.created_at) or "",
        metrics=row.metrics or {},
        priority=getattr(row, "priority", None) or "normal",
        emergency_status=getattr(row, "emergency_status", None) or "none",
        emergency_reason=getattr(row, "emergency_reason", None) or "",
        emergency_at=_iso(getattr(row, "emergency_at", None)),
        emergency_ack_at=_iso(getattr(row, "emergency_ack_at", None)),
        emergency_resolved_at=_iso(getattr(row, "emergency_resolved_at", None)),
        assigned_admin_user_id=str(row.assigned_admin_user_id) if getattr(row, "assigned_admin_user_id", None) else None,
        ops_note=getattr(row, "ops_note", None) or "",
        citizen_present=citizen_on,
        lawyer_present=lawyer_on,
        last_summon_at=_iso(row.last_summon_at) if row.summon_for_user_id == uid and row.last_summon_at else None,
        prior_join=await _prior_join(repo, row, uid),
        citizen_moderation=_moderation_out(parties.get(row.citizen_user_id)),
        lawyer_moderation=_moderation_out(parties.get(row.lawyer_user_id)),
        case_id=str(row.case_id) if getattr(row, "case_id", None) else None,
    )


def _attachment_out(att) -> AttachmentOut:
    return AttachmentOut(
        id=str(att.id),
        consultation_id=str(att.consultation_id),
        sender_user_id=str(att.sender_user_id),
        receiver_user_id=str(att.receiver_user_id),
        filename=att.filename,
        content_type=att.content_type,
        size_bytes=int(att.size_bytes or 0),
        kind=att.kind,
        url=f"/api/v1/appointments/{att.consultation_id}/attachments/{att.id}",
        created_at=_iso(att.created_at) or "",
    )


def _message_out(msg, attachment=None) -> MessageOut:
    return MessageOut(
        id=str(msg.id),
        sender_user_id=str(msg.sender_user_id),
        sender_role=msg.sender_role,
        body=msg.body,
        created_at=_iso(msg.created_at) or "",
        reactions=msg.reactions or {},
        kind=getattr(msg, "kind", None) or "text",
        attachment_id=str(msg.attachment_id) if getattr(msg, "attachment_id", None) else None,
        attachment=_attachment_out(attachment) if attachment is not None else None,
    )


async def _messages_out(
    repo: MarketplaceRepository,
    consultation_id: uuid.UUID,
    *,
    limit: int = 200,
    after: uuid.UUID | None = None,
) -> list[MessageOut]:
    rows = await repo.list_messages(consultation_id, limit=limit, after=after)
    attachments = {att.id: att for att in await repo.list_attachments(consultation_id)}
    return [
        _message_out(msg, attachments.get(msg.attachment_id) if getattr(msg, "attachment_id", None) else None)
        for msg in rows
    ]


def _receiver_for(row: Consultation, sender_id: uuid.UUID) -> uuid.UUID:
    if sender_id == row.citizen_user_id:
        return row.lawyer_user_id
    return row.citizen_user_id


async def _emit(appointment_id: uuid.UUID, event_type: str, payload: dict) -> None:
    frame = {"type": event_type, "payload": payload}
    await publish(str(appointment_id), frame)
    await publish_admin({"type": event_type, "appointment_id": str(appointment_id), "payload": payload})


async def _emit_summon(
    repo: MarketplaceRepository,
    row: Consultation,
    *,
    target: uuid.UUID,
    from_name: str,
) -> None:
    target_state = await _join_state(repo, row, target)
    payload = target_state.model_dump()
    payload["target_user_id"] = str(target)
    payload["from_name"] = from_name
    frame = {"type": "summon", "payload": payload}
    await publish(str(row.id), frame)
    await publish_admin({"type": "summon", "appointment_id": str(row.id), "payload": payload})
    await publish_user(str(target), {"type": "summon", "appointment_id": str(row.id), "payload": payload})


def _clear_summon_if_target(row: Consultation, user_id: uuid.UUID) -> bool:
    if row.summon_for_user_id != user_id:
        return False
    row.summon_for_user_id = None
    row.last_summon_at = None
    return True


async def _emit_summon_cleared(appointment_id: uuid.UUID, user_id: uuid.UUID) -> None:
    payload = {"user_id": str(user_id), "appointment_id": str(appointment_id)}
    frame = {"type": "summon_cleared", "payload": payload}
    await publish(str(appointment_id), frame)
    await publish_user(str(user_id), {"type": "summon_cleared", "appointment_id": str(appointment_id), "payload": payload})


def _incoming_call_payload(session) -> IncomingCallPayload:
    data = call_payload(session)
    return IncomingCallPayload(**data)


async def _emit_call_event(
    row: Consultation,
    event_type: str,
    session,
    *,
    extra_user_ids: list[str] | None = None,
) -> None:
    payload = call_payload(session)
    frame = {"type": event_type, "payload": payload}
    await publish(str(row.id), frame)
    await publish_admin({"type": event_type, "appointment_id": str(row.id), "payload": payload})
    targets = {session.caller_id, session.target_id, *(extra_user_ids or [])}
    for uid in targets:
        await publish_user(uid, {"type": event_type, "appointment_id": str(row.id), "payload": payload})


async def _emit_incoming_call(row: Consultation, session) -> None:
    await _emit_call_event(row, "incoming_call", session)


async def _emit_call_accepted(row: Consultation, session) -> None:
    await _emit_call_event(row, "call_accepted", session)


async def _emit_call_declined(row: Consultation, session) -> None:
    await _emit_call_event(row, "call_declined", session)


async def _emit_call_cancelled(row: Consultation, session) -> None:
    await _emit_call_event(row, "call_cancelled", session)


async def _emit_call_ended(row: Consultation, session) -> None:
    await _emit_call_event(row, "call_ended", session)


async def _emit_ops_update(
    repo: MarketplaceRepository,
    row: Consultation,
    user: CurrentUser,
) -> None:
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "ops_update", out.model_dump())


async def _emit_emergency(
    repo: MarketplaceRepository,
    row: Consultation,
    user: CurrentUser,
) -> AppointmentOut:
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "emergency", out.model_dump())
    return out


async def _emit_counsel_reassigned(
    row: Consultation,
    *,
    old_user_id: uuid.UUID,
    payload: dict,
) -> None:
    frame = {"type": "counsel_reassigned", "payload": payload}
    await publish(str(row.id), frame)
    await publish_admin({"type": "counsel_reassigned", "appointment_id": str(row.id), "payload": payload})
    await publish_user(
        str(old_user_id),
        {"type": "counsel_reassigned", "appointment_id": str(row.id), "payload": payload},
    )


def _event_summary(event_type: str, payload: dict, row: Consultation) -> str:
    summaries: dict[str, str] = {
        "joined": "Participant joined the room",
        "left": "Participant left the room",
        "emergency_opened": "SOS request opened",
        "emergency_acked": "SOS acknowledged by operations",
        "emergency_resolved": "SOS resolved",
        "extended": "Appointment window extended",
        "duration_changed": "Appointment duration adjusted",
        "reassigned": "Counsel reassigned",
        "counsel_removed": "Previous counsel removed from session",
        "system_message": "Platform operations message sent",
        "force_summoned": "Force summon sent",
        "participant_kicked": "Participant removed from session",
        "participant_suspended": "Participant suspended",
        "participant_unsuspended": "Participant suspension lifted",
        "force_cancelled": "Appointment force-cancelled",
        "force_completed": "Appointment force-completed",
        "priority_changed": "Priority updated",
        "call_ring": "Call started ringing",
        "call_accepted": "Call accepted",
        "call_declined": "Call declined",
        "call_cancelled": "Call cancelled",
        "call_started": "Call started",
        "call_ended": "Call ended",
        "admin_observe": "Operations joined observe mode",
    }
    base = summaries.get(event_type, event_type.replace("_", " ").capitalize())
    if event_type == "counsel_removed" and payload.get("lawyer_name"):
        return f"{base}: {payload['lawyer_name']}"
    if event_type == "emergency_opened" and payload.get("reason"):
        return f"{base} — {payload['reason'][:120]}"
    if event_type == "duration_changed":
        delta = payload.get("delta_minutes")
        if delta is not None:
            sign = "+" if delta >= 0 else ""
            return f"Duration changed ({sign}{delta} min)"
    return base


def _actor_role_for_event(actor_id: uuid.UUID | None, row: Consultation) -> str:
    if actor_id is None:
        return "system"
    if actor_id == row.citizen_user_id:
        return "citizen"
    if actor_id == row.lawyer_user_id:
        return "lawyer"
    return "admin"


async def _notify(
    session,
    *,
    user_id: uuid.UUID,
    kind: str,
    title: str,
    body: str,
    action_url: str,
) -> None:
    try:
        n = Notification(
            user_id=user_id,
            kind=kind,
            title=title,
            body=body,
            action_url=action_url,
        )
        session.add(n)
        await session.flush()
    except Exception as exc:
        logger.warning("notify_failed kind=%s user_id=%s error=%s", kind, user_id, exc)


def _is_live_session(apt: AppointmentOut) -> bool:
    if apt.status == "live":
        return True
    if apt.join_state != "joinable":
        return False
    return bool(apt.citizen_present or apt.lawyer_present)


async def _prior_join(repo: MarketplaceRepository, row: Consultation, uid: uuid.UUID) -> bool:
    part = await repo.participant(row.id, uid)
    return bool(part and (part.join_count or 0) > 0)


async def _join_state(
    repo: MarketplaceRepository,
    row: Consultation,
    uid: uuid.UUID,
    *,
    pending_summon_override: bool | None = None,
) -> JoinStateOut:
    pending_call = pending_incoming_call(row.id, uid)
    return JoinStateOut(
        appointment_id=str(row.id),
        join_state=join_phase(row),
        seconds_until_start=seconds_until_start(row),
        seconds_until_end=seconds_until_end(row),
        opponent_present=await repo.opponent_present(row.id, uid),
        pending_summon=pending_summon(row, uid) if pending_summon_override is None else pending_summon_override,
        opponent_typing=opponent_typing(row.id, uid),
        status=row.status,
        scheduled_at=_iso(row.scheduled_at),
        scheduled_end_at=_iso(row.scheduled_end_at),
        priority=getattr(row, "priority", None) or "normal",
        emergency_status=getattr(row, "emergency_status", None) or "none",
        emergency_reason=getattr(row, "emergency_reason", None) or "",
        last_summon_at=_iso(row.last_summon_at) if row.summon_for_user_id == uid and row.last_summon_at else None,
        prior_join=await _prior_join(repo, row, uid),
        pending_incoming_call=IncomingCallPayload(**pending_call) if pending_call else None,
    )


async def _load(
    repo: MarketplaceRepository, appointment_id: uuid.UUID, user: CurrentUser
) -> Consultation:
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if not _is_participant(user, row):
        raise HTTPException(status_code=403, detail="Not a party to this appointment")
    await refresh_status(repo, row)
    return row


@lawyers_router.get("", response_model=list[LawyerPublic])
async def list_lawyers(
    query: str | None = None,
    practice_area: str | None = None,
    city: str | None = None,
    verified: bool = Query(default=True),
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[LawyerPublic]:
    repo = MarketplaceRepository(session)
    lawyers = await repo.list_lawyers(
        query=query, practice_area=practice_area, city=city, verified_only=verified
    )
    scored = [
        (lawyer, score_lawyer(lawyer, practice_areas=[practice_area] if practice_area else None, city=city, query=query))
        for lawyer in lawyers
    ]
    scored.sort(key=lambda item: item[1], reverse=True)
    top = {scored[i][0].id for i in range(min(3, len(scored))) if scored[i][1] >= 78}
    return [
        _lawyer_public(lawyer, match_score=score, recommended=lawyer.id in top)
        for lawyer, score in scored
    ]


async def _require_advocate(user: CurrentUser) -> None:
    if "advocate" not in user.roles and "admin" not in user.roles:
        raise HTTPException(status_code=403, detail="Advocate listing is only available to counsel")


@lawyers_router.get("/me", response_model=LawyerPublic)
async def get_my_listing(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LawyerPublic:
    await _require_advocate(user)
    repo = MarketplaceRepository(session)
    lawyer = await repo.get_lawyer_by_user(uuid.UUID(user.user_id))
    if lawyer is None:
        lawyer = await repo.upsert_lawyer_for_user(
            uuid.UUID(user.user_id),
            full_name="Advocate",
            is_verified=True,
        )
    return _lawyer_public(lawyer, match_score=score_lawyer(lawyer))


@lawyers_router.put("/me", response_model=LawyerPublic)
async def upsert_my_listing(
    body: LawyerMeUpdate,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LawyerPublic:
    await _require_advocate(user)
    repo = MarketplaceRepository(session)
    lawyer = await repo.upsert_lawyer_for_user(
        uuid.UUID(user.user_id),
        full_name=(body.full_name or "").strip() or "Advocate",
        bar_council_id=body.bar_council_id,
        practice_areas=body.practice_areas,
        jurisdictions=body.jurisdictions,
        languages=body.languages,
        city=body.city,
        years_experience=body.years_experience,
        hourly_rate=body.hourly_rate,
        bio=body.bio,
        is_verified=True,
    )
    await session.commit()
    if _is_indexable(lawyer):
        asyncio.create_task(_generate_and_index(lawyer.id))
    return _lawyer_public(lawyer, match_score=score_lawyer(lawyer))


@lawyers_router.get("/{lawyer_id}", response_model=LawyerPublic)
async def get_lawyer(
    lawyer_id: uuid.UUID,
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LawyerPublic:
    repo = MarketplaceRepository(session)
    lawyer = await repo.get_lawyer(lawyer_id)
    if not lawyer:
        raise HTTPException(status_code=404, detail="Lawyer not found")
    return _lawyer_public(lawyer, match_score=score_lawyer(lawyer))


@lawyers_router.post("/match", response_model=list[LawyerPublic])
async def match_lawyers(
    body: MatchRequest,
    session: AsyncSession = Depends(get_session),
) -> list[LawyerPublic]:
    """Public endpoint — called by voicebot and chatbot without user auth."""
    store = get_lawyer_vector_store()
    repo = MarketplaceRepository(session)

    if store.is_ready:
        query_parts = list(body.practice_areas) + list(body.jurisdictions)
        if body.city:
            query_parts.append(body.city)
        query = " ".join(query_parts)
        hits = await store.search(query, limit=body.limit)
        if hits:
            ordered: list[Lawyer] = []
            for lawyer_id_str, _ in hits:
                try:
                    lawyer = await repo.get_lawyer(uuid.UUID(lawyer_id_str))
                except (ValueError, Exception):
                    continue
                if lawyer:
                    ordered.append(lawyer)
            if ordered:
                logger.info("match_lawyers source=qdrant count=%d query=%r", len(ordered), query)
                return [_lawyer_public(l, match_score=100, recommended=True) for l in ordered]

    # Fallback: score and rank from SQL
    logger.info("match_lawyers source=sql practice_areas=%s", body.practice_areas)
    lawyers = await repo.list_lawyers(verified_only=True, city=body.city)
    ranked = [
        (lawyer, score_lawyer(lawyer, practice_areas=body.practice_areas, city=body.city))
        for lawyer in lawyers
    ]
    ranked.sort(key=lambda item: item[1], reverse=True)
    return [_lawyer_public(lawyer, match_score=score, recommended=True) for lawyer, score in ranked[: body.limit]]


@appointments_router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    body: BookAppointmentRequest,
    user: CurrentUser = Depends(require_roles(Role.CITIZEN.value)),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    try:
        lawyer = await repo.get_lawyer(uuid.UUID(body.lawyer_id))
    except ValueError:
        lawyer = await repo.get_lawyer_by_slug(body.lawyer_id)
    if not lawyer or not lawyer.is_verified or not lawyer.user_id:
        raise HTTPException(status_code=404, detail="Verified lawyer not found")
    try:
        row = await book(
            repo,
            lawyer=lawyer,
            client_id=uuid.UUID(user.user_id),
            client_name=(body.citizen_name or "").strip() or "Citizen",
            date=body.date,
            time_slot=body.time_slot,
            matter_summary=body.matter_summary,
            source=body.source,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if body.case_id:
        try:
            row.case_id = uuid.UUID(body.case_id)
        except ValueError:
            pass

    date_str = row.scheduled_at.strftime("%d %b %Y") if row.scheduled_at else body.date
    await _notify(
        session,
        user_id=lawyer.user_id,
        kind="appointment_booked",
        title="New consultation booked",
        body=f"{row.citizen_display_name} has booked a consultation on {date_str} at {row.time_slot}.",
        action_url=f"/appointments/{row.id}",
    )
    lawyer_email, _ = await _get_user_email(session, lawyer.user_id)
    if lawyer_email:
        subject, html = booking_created_email(
            lawyer.full_name or "Advocate", row.citizen_display_name, date_str,
            row.time_slot or "", f"{_common_settings.frontend_url}/appointments/{row.id}",
        )
        asyncio.create_task(_email.send(to_email=lawyer_email, to_name=lawyer.full_name or "", subject=subject, html=html))

    booking_amount = lawyer.hourly_rate or 0
    prior = await repo.count_citizen_consultations(uuid.UUID(user.user_id), exclude_id=row.id)
    if prior == 0 and booking_amount > 0:
        booking_amount = 0
        row.metrics = {**(row.metrics or {}), "first_appointment_free": True}
    if booking_amount > 0:
        from decimal import Decimal
        try:
            await _billing.deduct_for_booking(
                user_id=uuid.UUID(user.user_id),
                amount=Decimal(str(booking_amount)),
                consultation_id=row.id,
            )
            row.metrics = {**(row.metrics or {}), "booking_amount": str(booking_amount)}
        except Exception as exc:
            if hasattr(exc, "response") and getattr(exc.response, "status_code", None) == 402:
                raise HTTPException(status_code=402, detail="Insufficient wallet balance to book this appointment") from exc
            logger.warning("billing_deduct_failed consultation_id=%s error=%s", row.id, exc)

    return await _to_appointment(repo, row, user, lawyer=lawyer)


@appointments_router.get("", response_model=list[AppointmentOut])
async def list_appointments(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    case_id: str | None = None,
) -> list[AppointmentOut]:
    repo = MarketplaceRepository(session)
    uid = uuid.UUID(user.user_id)
    parsed_case_id = uuid.UUID(case_id) if case_id else None
    lawyer_row = await repo.get_lawyer_by_user(uid)
    as_lawyer = lawyer_row is not None or user.has_role("advocate")
    rows = await repo.list_consultations_for_user(uid, as_lawyer=as_lawyer, case_id=parsed_case_id)
    if as_lawyer and not rows:
        rows = await repo.list_consultations_for_user(uid, as_lawyer=False, case_id=parsed_case_id)
    out: list[AppointmentOut] = []
    for row in rows:
        lawyer = await repo.get_lawyer(row.lawyer_id)
        out.append(await _to_appointment(repo, row, user, lawyer=lawyer))
    return out


@appointments_router.get("/inbox/events")
async def inbox_events(
    user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    uid = str(user.user_id)
    queue = subscribe_user(uid)

    async def gen():
        try:
            yield f"data: {json.dumps({'type': 'join', 'payload': {}})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(event, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            unsubscribe_user(uid, queue)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@appointments_router.get("/{appointment_id}", response_model=AppointmentOut)
async def get_appointment(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    return await _to_appointment(repo, row, user, lawyer=await repo.get_lawyer(row.lawyer_id))


@appointments_router.post("/{appointment_id}/confirm", response_model=AppointmentOut)
async def confirm_appointment(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    if user.user_id != str(row.lawyer_user_id):
        raise HTTPException(status_code=403, detail="Only counsel can confirm")
    if row.status == "requested":
        row.status = "confirmed"
        row.confirmed_at = now_ist()
        await repo.add_event(row.id, "confirmed", uuid.UUID(user.user_id), {})
        date_str = row.scheduled_at.strftime("%d %b %Y") if row.scheduled_at else ""
        await _notify(
            session,
            user_id=row.citizen_user_id,
            kind="appointment_confirmed",
            title="Consultation confirmed",
            body=f"{row.lawyer_display_name} has confirmed your consultation on {date_str} at {row.time_slot}.",
            action_url=f"/appointments/{row.id}",
        )
        citizen_email, citizen_name = await _get_user_email(session, row.citizen_user_id)
        if citizen_email:
            subject, html = appointment_confirmed_email(
                citizen_name or row.citizen_display_name, row.lawyer_display_name,
                date_str, row.time_slot or "",
                f"{_common_settings.frontend_url}/appointments/{row.id}",
            )
            asyncio.create_task(_email.send(to_email=citizen_email, to_name=citizen_name or "", subject=subject, html=html))
        await publish_user(str(row.citizen_user_id), {"type": "appointment_confirmed", "appointment_id": str(row.id)})
    return await _to_appointment(repo, row, user)


@appointments_router.post("/{appointment_id}/reject", response_model=AppointmentOut)
async def reject_appointment(
    appointment_id: uuid.UUID,
    body: ReasonRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    if user.user_id != str(row.lawyer_user_id):
        raise HTTPException(status_code=403, detail="Only counsel can reject an appointment request")
    if row.status != "requested":
        raise HTTPException(status_code=400, detail="Only pending appointments can be rejected")
    row.status = "cancelled"
    row.metrics = {**(row.metrics or {}), "rejection_reason": body.reason.strip(), "rejected_by": "lawyer"}
    await repo.add_event(row.id, "rejected", uuid.UUID(user.user_id), {"reason": body.reason.strip()})
    await publish_user(str(row.citizen_user_id), {"type": "appointment_rejected", "appointment_id": str(row.id), "reason": body.reason.strip()})
    date_str = row.scheduled_at.strftime("%d %b %Y") if row.scheduled_at else ""
    await _notify(
        session,
        user_id=row.citizen_user_id,
        kind="appointment_rejected",
        title="Consultation not accepted",
        body=f"{row.lawyer_display_name} could not accept your consultation request for {date_str}.",
        action_url=f"/appointments/{row.id}",
    )
    citizen_email, citizen_name = await _get_user_email(session, row.citizen_user_id)
    if citizen_email:
        subject, html = appointment_rejected_email(
            citizen_name or row.citizen_display_name, row.lawyer_display_name,
            date_str, row.time_slot or "",
        )
        asyncio.create_task(_email.send(to_email=citizen_email, to_name=citizen_name or "", subject=subject, html=html))
    return await _to_appointment(repo, row, user)


@appointments_router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    if row.status in {"completed", "expired", "no_show", "live"}:
        raise HTTPException(status_code=400, detail="Cannot cancel an appointment that is already in progress")
    row.status = "cancelled"
    await repo.add_event(row.id, "cancelled", uuid.UUID(user.user_id), {})

    uid = uuid.UUID(user.user_id)
    other_user_id = row.lawyer_user_id if uid == row.citizen_user_id else row.citizen_user_id
    canceller_name = row.citizen_display_name if uid == row.citizen_user_id else row.lawyer_display_name
    date_str = row.scheduled_at.strftime("%d %b %Y") if row.scheduled_at else ""
    await _notify(
        session,
        user_id=other_user_id,
        kind="appointment_cancelled",
        title="Consultation cancelled",
        body=f"{canceller_name} cancelled the consultation scheduled for {date_str}.",
        action_url=f"/appointments/{row.id}",
    )
    other_email, other_name = await _get_user_email(session, other_user_id)
    if other_email:
        subject, html = appointment_cancelled_email(
            other_name or "", canceller_name, date_str, row.time_slot or "",
        )
        asyncio.create_task(_email.send(to_email=other_email, to_name=other_name or "", subject=subject, html=html))
    await publish_user(str(other_user_id), {"type": "appointment_cancelled", "appointment_id": str(row.id)})

    # Refund policy:
    # - Lawyer cancels → citizen always gets a full refund
    # - Citizen cancels > 5 min before scheduled time → full refund
    # - Citizen cancels ≤ 5 min before scheduled time → no refund
    is_citizen_cancelling = uid == row.citizen_user_id
    refund_eligible = True
    if is_citizen_cancelling and row.scheduled_at:
        from datetime import timezone
        scheduled = row.scheduled_at if row.scheduled_at.tzinfo else row.scheduled_at.replace(tzinfo=timezone.utc)
        minutes_until = (scheduled - datetime.now(timezone.utc)).total_seconds() / 60
        if minutes_until < 5:
            refund_eligible = False

    if refund_eligible:
        booking_amount_str = (row.metrics or {}).get("booking_amount")
        if booking_amount_str:
            from decimal import Decimal
            asyncio.create_task(
                _billing.credit_refund(
                    user_id=row.citizen_user_id,
                    amount=Decimal(booking_amount_str),
                    consultation_id=row.id,
                )
            )

    return await _to_appointment(repo, row, user)


@appointments_router.get("/{appointment_id}/join-state", response_model=JoinStateOut)
async def get_join_state(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> JoinStateOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    uid = uuid.UUID(user.user_id)
    await repo.upsert_participant(row.id, uid, _role_for(user, row), bump_join=False)
    if await promote_live_if_active(repo, row):
        await _emit_ops_update(repo, row, user)
    return await _join_state(repo, row, uid)


@appointments_router.post("/{appointment_id}/room-token", response_model=RoomTokenOut)
async def room_token(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RoomTokenOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    if join_phase(row) != "joinable":
        raise HTTPException(status_code=403, detail="Join window is closed", headers={"X-Join-State": join_phase(row)})
    uid = uuid.UUID(user.user_id)
    role = _role_for(user, row)
    existing = await repo.participant(row.id, uid)
    blocked, detail = _participant_blocked(existing)
    if blocked:
        raise HTTPException(status_code=403, detail=detail)
    if _clear_summon_if_target(row, uid):
        await _emit_summon_cleared(row.id, uid)
    await repo.upsert_participant(row.id, uid, role, bump_join=True)
    went_live = False
    if row.status in {"requested", "confirmed"}:
        row.status = "live"
        row.live_started_at = now_ist()
        await repo.add_event(row.id, "joined", uid, {"role": role})
        went_live = True
    elif await promote_live_if_active(repo, row):
        went_live = True
    if went_live:
        await _emit_ops_update(repo, row, user)
    name = row.lawyer_display_name if role == "lawyer" else row.citizen_display_name
    room_name = row.livekit_room or f"apt-{row.id}"
    minted = mint_room_token(room=room_name, identity=user.user_id, name=name, role=role)
    if not minted:
        return RoomTokenOut(url=None, token=None, room=room_name, configured=False, mode="polling")
    token, url = minted
    return RoomTokenOut(url=url, token=token, room=room_name, configured=True, mode="livekit")


@appointments_router.post("/{appointment_id}/leave")
async def leave_appointment(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    uid = uuid.UUID(user.user_id)
    await repo.leave_participant(row.id, uid)
    if _clear_summon_if_target(row, uid):
        await _emit_summon_cleared(row.id, uid)
    await repo.add_event(row.id, "left", uid, {"role": _role_for(user, row)})
    await _emit_ops_update(repo, row, user)
    return {"ok": True}


@appointments_router.post("/{appointment_id}/emergency", response_model=AppointmentOut)
async def request_emergency(
    appointment_id: uuid.UUID,
    body: EmergencyRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    if user.has_role("admin"):
        raise HTTPException(status_code=403, detail="Only appointment parties may request emergency help")
    current = getattr(row, "emergency_status", None) or "none"
    if current in {"open", "ack"}:
        raise HTTPException(status_code=409, detail="Emergency already open")
    uid = uuid.UUID(user.user_id)
    row.emergency_status = "open"
    row.emergency_reason = body.reason.strip()
    row.emergency_at = now_ist()
    row.emergency_ack_at = None
    row.emergency_resolved_at = None
    row.priority = "emergency"
    await repo.add_event(row.id, "emergency_opened", uid, {"reason": row.emergency_reason})
    return await _emit_emergency(repo, row, user)


@appointments_router.post("/{appointment_id}/emergency/resolve", response_model=AppointmentOut)
async def resolve_emergency(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    current = getattr(row, "emergency_status", None) or "none"
    if current not in {"open", "ack"}:
        raise HTTPException(status_code=400, detail="No open emergency to resolve")
    uid = uuid.UUID(user.user_id)
    row.emergency_status = "resolved"
    row.emergency_resolved_at = now_ist()
    await repo.add_event(row.id, "emergency_resolved", uid, {"by": _role_for(user, row)})
    return await _emit_emergency(repo, row, user)


@appointments_router.get("/{appointment_id}/messages", response_model=list[MessageOut])
async def list_messages(
    appointment_id: uuid.UUID,
    after: uuid.UUID | None = None,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[MessageOut]:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    await repo.upsert_participant(row.id, uuid.UUID(user.user_id), _role_for(user, row))
    return await _messages_out(repo, row.id, limit=200, after=after)


@appointments_router.get("/{appointment_id}/events")
async def room_events(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    async with session_scope() as session:
        repo = MarketplaceRepository(session)
        row = await _load(repo, appointment_id, user)
        await repo.upsert_participant(row.id, uuid.UUID(user.user_id), _role_for(user, row))
        aid = str(row.id)
    uid = user.user_id
    queue = subscribe(aid)

    async def gen():
        try:
            yield f"data: {json.dumps({'type': 'join', 'payload': {'user_id': uid}})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(event, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            unsubscribe(aid, queue)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@appointments_router.post("/{appointment_id}/messages", response_model=MessageOut, status_code=201)
async def post_message(
    appointment_id: uuid.UUID,
    body: PostMessageRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MessageOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    uid = uuid.UUID(user.user_id)
    await _require_participant_active(repo, row, uid)
    if join_phase(row) == "expired" and row.status not in {"live"}:
        raise HTTPException(status_code=403, detail="Chat is closed")
    msg = await repo.add_message(
        consultation_id=row.id,
        sender_user_id=uid,
        sender_role=_role_for(user, row),
        body=body.body.strip(),
        reactions={},
        kind="text",
    )
    out = _message_out(msg)
    await _emit(row.id, "message", out.model_dump())
    return out


@appointments_router.post("/{appointment_id}/messages/{message_id}/reactions", response_model=MessageOut)
async def react_message(
    appointment_id: uuid.UUID,
    message_id: uuid.UUID,
    body: ReactionRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MessageOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    await _require_participant_active(repo, row, uuid.UUID(user.user_id))
    msg = await repo.get_message(message_id)
    if not msg or msg.consultation_id != appointment_id:
        raise HTTPException(status_code=404, detail="Message not found")
    reactions = dict(msg.reactions or {})
    holders = list(reactions.get(body.emoji, []))
    if user.user_id in holders:
        holders = [h for h in holders if h != user.user_id]
    else:
        holders.append(user.user_id)
    if holders:
        reactions[body.emoji] = holders
    else:
        reactions.pop(body.emoji, None)
    msg.reactions = reactions
    out = _message_out(msg)
    await _emit(
        appointment_id,
        "reaction",
        {"messageId": str(msg.id), "reactions": out.reactions},
    )
    return out


@appointments_router.post("/{appointment_id}/read")
async def mark_read(
    appointment_id: uuid.UUID,
    message_id: uuid.UUID | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    part = await repo.upsert_participant(row.id, uuid.UUID(user.user_id), _role_for(user, row))
    if message_id:
        part.last_read_message_id = message_id
    return {"ok": True}


@appointments_router.post("/{appointment_id}/typing")
async def mark_typing(
    appointment_id: uuid.UUID,
    body: TypingRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    uid = uuid.UUID(user.user_id)
    await _require_participant_active(repo, row, uid)
    on = True if body is None else body.on
    set_typing(row.id, uid, on)
    await repo.upsert_participant(row.id, uid, _role_for(user, row))
    await _emit(row.id, "typing", {"user_id": str(uid), "on": on})
    return {"ok": True, "on": on}


@appointments_router.post("/{appointment_id}/attachments", response_model=MessageOut, status_code=201)
async def upload_attachment(
    appointment_id: uuid.UUID,
    file: UploadFile = File(...),
    caption: str = Form(""),
    kind: str = Form("document"),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MessageOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    sender_id = uuid.UUID(user.user_id)
    await _require_participant_active(repo, row, sender_id)
    if join_phase(row) == "expired" and row.status not in {"live"}:
        raise HTTPException(status_code=403, detail="Chat is closed")
    raw = await file.read()
    filename = file.filename or "file"
    error = validate_upload(filename=filename, content_type=file.content_type or "", size=len(raw))
    if error:
        raise HTTPException(status_code=400, detail=error)
    attachment_id = uuid.uuid4()
    stored = write_bytes(row.id, attachment_id, raw)
    att_kind = infer_kind(filename, kind)
    att = await repo.add_attachment(
        id=attachment_id,
        consultation_id=row.id,
        sender_user_id=sender_id,
        receiver_user_id=_receiver_for(row, sender_id),
        filename=filename[:255],
        content_type=(file.content_type or "application/octet-stream")[:120],
        size_bytes=len(raw),
        kind=att_kind,
        storage_path=stored,
    )
    msg = await repo.add_message(
        consultation_id=row.id,
        sender_user_id=sender_id,
        sender_role=_role_for(user, row),
        body=(caption or filename).strip()[:4000] or filename,
        reactions={},
        kind="attachment",
        attachment_id=att.id,
    )
    out = _message_out(msg, att)
    dumped = out.model_dump()
    await _emit(row.id, "attachment", dumped)
    await _emit(row.id, "message", dumped)
    return out


@appointments_router.get("/{appointment_id}/attachments/{attachment_id}")
async def download_attachment(
    appointment_id: uuid.UUID,
    attachment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FileResponse:
    repo = MarketplaceRepository(session)
    await _load(repo, appointment_id, user)
    att = await repo.get_attachment(attachment_id)
    if not att or att.consultation_id != appointment_id:
        raise HTTPException(status_code=404, detail="File not found")
    path = resolve_path(att.storage_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    inline = (
        att.kind in IMAGE_KINDS
        or att.kind in AUDIO_KINDS
        or att.content_type.startswith("image/")
        or att.content_type.startswith("audio/")
    )
    return FileResponse(
        path,
        media_type=att.content_type or "application/octet-stream",
        filename=att.filename,
        content_disposition_type="inline" if inline else "attachment",
    )


@appointments_router.post("/{appointment_id}/summon", response_model=JoinStateOut)
async def summon_opponent(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> JoinStateOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    if join_phase(row) != "joinable":
        raise HTTPException(status_code=403, detail="Join window is closed")
    uid = uuid.UUID(user.user_id)
    await _require_participant_active(repo, row, uid)
    if await repo.opponent_present(row.id, uid):
        raise HTTPException(status_code=409, detail="Opponent is already in the room")
    target = row.lawyer_user_id if user.user_id == str(row.citizen_user_id) else row.citizen_user_id
    row.last_summon_at = now_ist()
    row.summon_for_user_id = target
    await repo.add_event(row.id, "summon", uuid.UUID(user.user_id), {"target": str(target)})
    uid = uuid.UUID(user.user_id)
    from_name = row.citizen_display_name if user.user_id == str(row.citizen_user_id) else row.lawyer_display_name
    await _emit_summon(repo, row, target=target, from_name=from_name)
    return await _join_state(repo, row, uid, pending_summon_override=False)


@appointments_router.post("/{appointment_id}/summon/dismiss", response_model=JoinStateOut)
async def dismiss_summon(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> JoinStateOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    uid = uuid.UUID(user.user_id)
    if _clear_summon_if_target(row, uid):
        await _emit_summon_cleared(row.id, uid)
    return await _join_state(repo, row, uid, pending_summon_override=False)


@appointments_router.post("/{appointment_id}/call/ring")
async def ring_call(
    appointment_id: uuid.UUID,
    body: CallRingRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IncomingCallPayload:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    if join_phase(row) != "joinable":
        raise HTTPException(status_code=403, detail="Join window is closed")
    uid = uuid.UUID(user.user_id)
    await _require_participant_active(repo, row, uid)
    target = row.lawyer_user_id if uid == row.citizen_user_id else row.citizen_user_id
    if uid == target:
        raise HTTPException(status_code=409, detail="Cannot call yourself")
    caller_name = row.citizen_display_name if uid == row.citizen_user_id else row.lawyer_display_name
    try:
        call_session = start_ring(
            appointment_id=row.id,
            caller_id=uid,
            target_id=target,
            mode=body.mode,
            caller_name=caller_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await repo.add_event(row.id, "call_ring", uid, {"mode": body.mode, "call_id": call_session.call_id})
    await _emit_incoming_call(row, call_session)
    return _incoming_call_payload(call_session)


@appointments_router.post("/{appointment_id}/call/respond")
async def respond_call(
    appointment_id: uuid.UUID,
    body: CallRespondRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IncomingCallPayload:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    uid = uuid.UUID(user.user_id)
    await _require_participant_active(repo, row, uid)
    try:
        if body.action == "accept":
            call_session = accept_call(row.id, body.call_id, uid)
            await repo.add_event(row.id, "call_accepted", uid, {"call_id": body.call_id})
            await _emit_call_accepted(row, call_session)
        else:
            call_session = decline_call(row.id, body.call_id, uid)
            await repo.add_event(row.id, "call_declined", uid, {"call_id": body.call_id})
            await _emit_call_declined(row, call_session)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _incoming_call_payload(call_session)


@appointments_router.post("/{appointment_id}/call/cancel")
async def cancel_call_endpoint(
    appointment_id: uuid.UUID,
    body: CallCancelRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> IncomingCallPayload:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    uid = uuid.UUID(user.user_id)
    try:
        call_session = cancel_call(row.id, body.call_id, uid)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await repo.add_event(row.id, "call_cancelled", uid, {"call_id": body.call_id})
    await _emit_call_cancelled(row, call_session)
    return _incoming_call_payload(call_session)


@appointments_router.post("/{appointment_id}/call-event")
async def record_call_event(
    appointment_id: uuid.UUID,
    body: CallEventRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    metrics = dict(row.metrics or {})
    if body.type == "started":
        await repo.add_event(row.id, "call_started", uuid.UUID(user.user_id), {})
    else:
        metrics["talk_seconds"] = int(metrics.get("talk_seconds") or 0) + body.talk_seconds
        row.metrics = metrics
        await repo.add_event(
            row.id, "call_ended", uuid.UUID(user.user_id), {"talk_seconds": body.talk_seconds}
        )
        active = get_active_call(row.id)
        if active:
            ended = end_call(row.id)
            if ended:
                await _emit_call_ended(row, ended)
    return {"ok": True, "metrics": metrics}


async def _ops_snapshot(
    repo: MarketplaceRepository, row: Consultation, user: CurrentUser
) -> AppointmentOut:
    lawyer = await repo.get_lawyer(row.lawyer_id)
    return await _to_appointment(repo, row, user, lawyer=lawyer)



@appointments_router.get("/{appointment_id}/transcript", response_model=TranscriptOut)
async def transcript(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TranscriptOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    if join_phase(row) != "expired" and row.status not in {"completed", "expired", "no_show", "cancelled"}:
        raise HTTPException(status_code=400, detail="Transcript is available after the window closes")
    lawyer = await repo.get_lawyer(row.lawyer_id)
    return TranscriptOut(
        appointment=await _to_appointment(repo, row, user, lawyer=lawyer),
        messages=await _messages_out(repo, row.id, limit=500),
    )


def _event_out(event) -> AdminEventOut:
    return AdminEventOut(
        id=str(event.id),
        type=event.type,
        actor_user_id=str(event.actor_user_id) if event.actor_user_id else None,
        payload=event.payload or {},
        created_at=_iso(event.created_at),
    )


@admin_router.get("/appointments")
async def admin_list_appointments(
    status_filter: str | None = Query(default=None, alias="status"),
    lawyer_id: uuid.UUID | None = None,
    citizen_id: uuid.UUID | None = None,
    search: str | None = None,
    emergency: str | None = None,
    live_only: bool = Query(default=False, alias="live"),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    repo = MarketplaceRepository(session)
    rows = await repo.list_all_consultations(
        status=status_filter,
        lawyer_id=lawyer_id,
        citizen_id=citizen_id,
        search=search,
        emergency=emergency,
    )
    items = []
    live_matrix = []
    counts: dict[str, int] = {}
    emergency_counts: dict[str, int] = {}
    for row in rows:
        await refresh_status(repo, row)
        await promote_live_if_active(repo, row)
        lawyer = await repo.get_lawyer(row.lawyer_id)
        apt = await _to_appointment(repo, row, user, lawyer=lawyer)
        counts[row.status] = counts.get(row.status, 0) + 1
        es = getattr(row, "emergency_status", None) or "none"
        emergency_counts[es] = emergency_counts.get(es, 0) + 1
        if _is_live_session(apt):
            live_matrix.append(apt)
        if live_only and not _is_live_session(apt):
            continue
        items.append(apt)
    live_matrix.sort(
        key=lambda a: (0 if a.emergency_status in {"open", "ack"} else 1, -(a.seconds_until_end or 0)),
    )
    items.sort(key=lambda a: a.scheduled_at or "", reverse=True)
    items.sort(key=lambda a: 0 if _is_live_session(a) else 1)
    items.sort(key=lambda a: 0 if a.emergency_status in {"open", "ack"} else 1)
    return {
        "items": items,
        "live_matrix": live_matrix,
        "counts": counts,
        "emergency_counts": emergency_counts,
        "total": len(items),
        "live_total": len(live_matrix),
    }


@admin_router.get("/appointments/{appointment_id}")
async def admin_get_appointment(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    await refresh_status(repo, row)
    messages = await _messages_out(repo, row.id, limit=500)
    events = [_event_out(e) for e in await repo.list_events(row.id, limit=500)]
    return {
        "appointment": await _to_appointment(repo, row, user, lawyer=await repo.get_lawyer(row.lawyer_id)),
        "messages": messages,
        "events": events,
    }


@admin_router.post("/appointments/{appointment_id}/force-cancel")
async def admin_force_cancel(
    appointment_id: uuid.UUID,
    body: ReasonRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    row.status = "cancelled"
    await repo.add_event(
        row.id,
        "force_cancelled",
        uuid.UUID(user.user_id),
        {"admin": True, "reason": body.reason.strip()},
    )
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "ops_update", out.model_dump())
    return out


@admin_router.post("/appointments/{appointment_id}/force-complete")
async def admin_force_complete(
    appointment_id: uuid.UUID,
    body: ReasonRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    row.status = "completed"
    row.completed_at = now_ist()
    await repo.add_event(
        row.id,
        "force_completed",
        uuid.UUID(user.user_id),
        {"admin": True, "reason": body.reason.strip()},
    )

    booking_amount_str = (row.metrics or {}).get("booking_amount")
    if booking_amount_str:
        from decimal import Decimal
        asyncio.create_task(
            _billing.credit_advocate_earning(
                advocate_user_id=row.lawyer_user_id,
                amount=Decimal(booking_amount_str),
                consultation_id=row.id,
            )
        )

    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "ops_update", out.model_dump())
    return out



@admin_router.post("/appointments/{appointment_id}/priority", response_model=AppointmentOut)
async def admin_set_priority(
    appointment_id: uuid.UUID,
    body: PriorityRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if body.priority not in PRIORITIES:
        raise HTTPException(status_code=400, detail="Invalid priority")
    row.priority = body.priority
    await repo.add_event(row.id, "priority_changed", uuid.UUID(user.user_id), {"priority": body.priority})
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "ops_update", out.model_dump())
    return out


@admin_router.post("/appointments/{appointment_id}/extend", response_model=AppointmentOut)
async def admin_extend_appointment(
    appointment_id: uuid.UUID,
    body: ExtendRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    end = row.scheduled_end_at
    if end is None:
        raise HTTPException(status_code=400, detail="Appointment has no end time")
    if end.tzinfo is None:
        end = end.replace(tzinfo=now_ist().tzinfo)
    row.scheduled_end_at = end + timedelta(minutes=body.minutes)
    await repo.add_event(
        row.id,
        "extended",
        uuid.UUID(user.user_id),
        {"minutes": body.minutes, "scheduled_end_at": _iso(row.scheduled_end_at)},
    )
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "ops_update", out.model_dump())
    return out


@admin_router.post("/appointments/{appointment_id}/reassign", response_model=AppointmentOut)
async def admin_reassign_appointment(
    appointment_id: uuid.UUID,
    body: ReassignRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    try:
        new_lawyer_id = uuid.UUID(body.lawyer_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid lawyer id") from exc
    lawyer = await repo.get_lawyer(new_lawyer_id)
    if not lawyer or not lawyer.is_verified or not lawyer.user_id:
        raise HTTPException(status_code=404, detail="Verified counsel not found")
    if lawyer.user_id == row.lawyer_user_id:
        raise HTTPException(status_code=400, detail="Counsel is already assigned to this appointment")
    admin_id = uuid.UUID(user.user_id)
    prev_user_id = row.lawyer_user_id
    prev = {
        "lawyer_id": str(row.lawyer_id),
        "lawyer_user_id": str(row.lawyer_user_id),
        "lawyer_name": row.lawyer_display_name,
    }
    removal_reason = body.reason.strip() or (
        "This consultation has been reassigned to another advocate by platform operations. "
        "You no longer have access to this appointment."
    )
    room_name = row.livekit_room or f"apt-{row.id}"
    await remove_room_participant(room=room_name, identity=str(prev_user_id))
    await repo.leave_participant(row.id, prev_user_id)
    if row.summon_for_user_id == prev_user_id:
        row.summon_for_user_id = None
        row.last_summon_at = None
    call_session = get_active_call(row.id)
    if call_session:
        await _emit_call_event(row, "call_cancelled", call_session)
        _ACTIVE_CALLS.pop(str(row.id), None)
    row.lawyer_id = lawyer.id
    row.lawyer_user_id = lawyer.user_id
    row.lawyer_display_name = lawyer.full_name
    await repo.add_event(
        row.id,
        "counsel_removed",
        admin_id,
        {
            "lawyer_user_id": prev["lawyer_user_id"],
            "lawyer_name": prev["lawyer_name"],
            "reason": removal_reason,
        },
    )
    await repo.add_event(
        row.id,
        "reassigned",
        admin_id,
        {
            "from": prev,
            "to": {"lawyer_id": str(lawyer.id), "lawyer_name": lawyer.full_name},
            "reason": removal_reason,
        },
    )
    removal_msg = (
        f"Platform operations: counsel has been changed from {prev['lawyer_name']} to {lawyer.full_name}. "
        f"The previous advocate no longer has access to this consultation."
    )
    await repo.add_message(
        consultation_id=row.id,
        sender_user_id=admin_id,
        sender_role="admin",
        body=removal_msg,
        reactions={},
        kind="text",
    )
    await _notify(
        session,
        user_id=prev_user_id,
        kind="counsel_reassigned",
        title="Consultation reassigned",
        body=removal_reason,
        action_url="/appointments",
    )
    out = await _ops_snapshot(repo, row, user)
    reassign_payload = {
        **out.model_dump(),
        "removed_counsel_user_id": prev["lawyer_user_id"],
        "removed_counsel_name": prev["lawyer_name"],
        "reason": removal_reason,
    }
    await _emit_counsel_reassigned(row, old_user_id=prev_user_id, payload=reassign_payload)
    await _emit(row.id, "ops_update", out.model_dump())
    await publish_user(
        str(lawyer.user_id),
        {"type": "appointment_reassigned", "appointment_id": str(row.id), "payload": out.model_dump()},
    )
    return out


@admin_router.post("/appointments/{appointment_id}/duration", response_model=AppointmentOut)
async def admin_set_duration(
    appointment_id: uuid.UUID,
    body: DurationRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    end = row.scheduled_end_at
    if end is None:
        raise HTTPException(status_code=400, detail="Appointment has no end time")
    if end.tzinfo is None:
        end = end.replace(tzinfo=now_ist().tzinfo)
    start = row.scheduled_at
    if start and start.tzinfo is None:
        start = start.replace(tzinfo=now_ist().tzinfo)
    from_end = end
    if body.scheduled_end_at:
        try:
            new_end = datetime.fromisoformat(body.scheduled_end_at.replace("Z", "+00:00"))
            if new_end.tzinfo is None:
                new_end = new_end.replace(tzinfo=now_ist().tzinfo)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid scheduled_end_at") from exc
        end = new_end
    elif body.minutes_delta is not None:
        end = end + timedelta(minutes=body.minutes_delta)
    else:
        raise HTTPException(status_code=400, detail="Provide scheduled_end_at or minutes_delta")
    instant = now_ist()
    min_start = (start or instant) + timedelta(minutes=5)
    if end < min_start:
        raise HTTPException(status_code=400, detail="Cannot shorten before session start")
    if row.status == "live" and end <= instant + timedelta(minutes=1):
        raise HTTPException(status_code=400, detail="End time must be at least 1 minute from now")
    if start and (end - start).total_seconds() > 240 * 60:
        raise HTTPException(status_code=400, detail="Appointment window cannot exceed 240 minutes")
    delta_minutes = int(round((end - from_end).total_seconds() / 60))
    row.scheduled_end_at = end
    await repo.add_event(
        row.id,
        "duration_changed",
        uuid.UUID(user.user_id),
        {
            "from": _iso(from_end),
            "to": _iso(end),
            "delta_minutes": delta_minutes,
        },
    )
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "ops_update", out.model_dump())
    return out


@admin_router.get("/appointments/{appointment_id}/logs", response_model=ActivityLogPageOut)
async def admin_appointment_logs(
    appointment_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=50, ge=1, le=200),
    event_type: str | None = Query(default=None, alias="type"),
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ActivityLogPageOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    total = await repo.count_events(row.id, event_type=event_type)
    offset = (page - 1) * size
    events = await repo.list_events(row.id, limit=size, offset=offset, event_type=event_type, descending=True)
    items: list[ActivityLogOut] = []
    for event in events:
        payload = event.payload or {}
        actor_id = event.actor_user_id
        actor_name = ""
        actor_role = _actor_role_for_event(actor_id, row)
        if actor_id == row.citizen_user_id:
            actor_name = row.citizen_display_name or "Citizen"
        elif actor_id == row.lawyer_user_id:
            actor_name = row.lawyer_display_name or "Counsel"
        elif actor_id is not None:
            actor_name = "Platform ops"
        items.append(
            ActivityLogOut(
                id=str(event.id),
                type=event.type,
                actor_user_id=str(actor_id) if actor_id else None,
                actor_name=actor_name,
                actor_role=actor_role,
                summary=_event_summary(event.type, payload, row),
                payload=payload,
                created_at=_iso(event.created_at),
            )
        )
    return ActivityLogPageOut(items=items, total=total, page=page, size=size)


@admin_router.post("/appointments/{appointment_id}/system-message", response_model=MessageOut, status_code=201)
async def admin_system_message(
    appointment_id: uuid.UUID,
    body: SystemMessageRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> MessageOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    admin_id = uuid.UUID(user.user_id)
    text = body.body.strip()
    msg = await repo.add_message(
        consultation_id=row.id,
        sender_user_id=admin_id,
        sender_role="admin",
        body=text,
        reactions={},
        kind="text",
    )
    row.ops_note = text[:500]
    await repo.add_event(row.id, "system_message", admin_id, {"body": text})
    out = _message_out(msg)
    await _emit(row.id, "message", out.model_dump())
    await _emit(row.id, "ops_update", (await _ops_snapshot(repo, row, user)).model_dump())
    return out


@admin_router.post("/appointments/{appointment_id}/force-summon", response_model=JoinStateOut)
async def admin_force_summon(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> JoinStateOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    citizen_on, lawyer_on = await repo.party_presence(row)
    if citizen_on and not lawyer_on:
        target = row.lawyer_user_id
    elif lawyer_on and not citizen_on:
        target = row.citizen_user_id
    else:
        target = row.lawyer_user_id
    row.last_summon_at = now_ist()
    row.summon_for_user_id = target
    await repo.add_event(row.id, "force_summoned", uuid.UUID(user.user_id), {"target": str(target)})
    from_name = "Platform ops"
    await _emit_summon(repo, row, target=target, from_name=from_name)
    out = await _join_state(repo, row, uuid.UUID(user.user_id))
    await _emit(row.id, "ops_update", (await _ops_snapshot(repo, row, user)).model_dump())
    return out


async def _apply_moderation(
    repo: MarketplaceRepository,
    row: Consultation,
    user: CurrentUser,
    *,
    target: str,
    action: str,
    reason: str = "",
    minutes: int | None = None,
) -> AppointmentOut:
    target_id, role, target_name = _target_party(row, target)
    part = await repo.get_or_create_participant(row.id, target_id, role)
    admin_id = uuid.UUID(user.user_id)
    until: datetime | None = None
    if action == "kick":
        part.moderation_status = "kicked"
        part.suspended_until = None
        part.moderation_reason = reason.strip()
        event_type = "participant_kicked"
    elif action == "suspend":
        until = now_ist() + timedelta(minutes=int(minutes or 15))
        part.moderation_status = "suspended"
        part.suspended_until = until
        part.moderation_reason = reason.strip()
        event_type = "participant_suspended"
    else:
        part.moderation_status = "none"
        part.suspended_until = None
        part.moderation_reason = ""
        event_type = "participant_unsuspended"
    await repo.leave_participant(row.id, target_id)
    await repo.add_event(
        row.id,
        event_type,
        admin_id,
        {
            "target": target,
            "target_user_id": str(target_id),
            "reason": reason.strip(),
            "minutes": minutes,
        },
    )
    room_name = row.livekit_room or f"apt-{row.id}"
    if action != "unsuspend":
        await remove_room_participant(room=room_name, identity=str(target_id))
    out = await _ops_snapshot(repo, row, user)
    payload = {
        "action": action,
        "target": target,
        "target_user_id": str(target_id),
        "target_name": target_name,
        "reason": reason.strip(),
        "minutes": minutes,
        "suspended_until": _iso(until),
        "appointment": out.model_dump(),
    }
    await _emit(row.id, "moderation", payload)
    await _emit(row.id, "ops_update", out.model_dump())
    return out


@admin_router.post("/appointments/{appointment_id}/moderate/kick", response_model=AppointmentOut)
async def admin_kick_participant(
    appointment_id: uuid.UUID,
    body: ModerateKickRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return await _apply_moderation(repo, row, user, target=body.target, action="kick", reason=body.reason)


@admin_router.post("/appointments/{appointment_id}/moderate/suspend", response_model=AppointmentOut)
async def admin_suspend_participant(
    appointment_id: uuid.UUID,
    body: ModerateSuspendRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return await _apply_moderation(
        repo, row, user, target=body.target, action="suspend", reason=body.reason, minutes=body.minutes
    )


@admin_router.post("/appointments/{appointment_id}/moderate/unsuspend", response_model=AppointmentOut)
async def admin_unsuspend_participant(
    appointment_id: uuid.UUID,
    body: ModerateUnsuspendRequest,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return await _apply_moderation(repo, row, user, target=body.target, action="unsuspend")


@admin_router.post("/appointments/{appointment_id}/emergency/ack", response_model=AppointmentOut)
async def admin_ack_emergency(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    current = getattr(row, "emergency_status", None) or "none"
    if current != "open":
        raise HTTPException(status_code=400, detail="No open emergency to acknowledge")
    admin_id = uuid.UUID(user.user_id)
    row.emergency_status = "ack"
    row.emergency_ack_at = now_ist()
    if not getattr(row, "assigned_admin_user_id", None):
        row.assigned_admin_user_id = admin_id
    await repo.add_event(row.id, "emergency_acked", admin_id, {})
    return await _emit_emergency(repo, row, user)


@admin_router.post("/appointments/{appointment_id}/emergency/resolve", response_model=AppointmentOut)
async def admin_resolve_emergency(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    current = getattr(row, "emergency_status", None) or "none"
    if current not in {"open", "ack"}:
        raise HTTPException(status_code=400, detail="No open emergency to resolve")
    admin_id = uuid.UUID(user.user_id)
    row.emergency_status = "resolved"
    row.emergency_resolved_at = now_ist()
    await repo.add_event(row.id, "emergency_resolved", admin_id, {"by": "admin"})
    return await _emit_emergency(repo, row, user)


async def _session_health(
    repo: MarketplaceRepository,
    row: Consultation,
) -> SessionHealthOut:
    await refresh_status(repo, row)
    citizen_on, lawyer_on = await repo.party_presence(row)
    parties = await repo.party_participants(row)
    room_name = row.livekit_room or f"apt-{row.id}"
    lk_participants = await list_room_participants(room=room_name)
    lk_identities = {p["identity"] for p in lk_participants}

    def party_health(user_id: uuid.UUID, present: bool) -> PartyHealthOut:
        part = parties.get(user_id)
        return PartyHealthOut(
            present=present,
            last_seen_at=_iso(part.last_seen_at) if part and part.last_seen_at else None,
            moderation=_moderation_out(part),
            livekit_connected=str(user_id) in lk_identities,
        )

    call_session = get_active_call(row.id)
    call_info: dict | None = None
    if call_session:
        call_info = {
            "active": True,
            "phase": call_session.status,
            "caller": call_session.caller_name,
            "mode": call_session.mode,
            "call_id": call_session.call_id,
        }

    summon_info: dict | None = None
    if row.summon_for_user_id and row.last_summon_at:
        elapsed = (now_ist() - _aware_ist(row.last_summon_at)).total_seconds()
        if elapsed <= SUMMON_TTL_SECONDS:
            target = "lawyer" if row.summon_for_user_id == row.lawyer_user_id else "citizen"
            summon_info = {
                "pending": True,
                "target": target,
                "expires_at": _iso(row.last_summon_at + timedelta(seconds=SUMMON_TTL_SECONDS)),
            }

    configured = livekit_configured()
    mode = "livekit" if configured else "polling"
    issues: list[str] = []

    if not citizen_on and join_phase(row) == "joinable":
        issues.append("citizen_not_present")
    if not lawyer_on and join_phase(row) == "joinable":
        issues.append("lawyer_not_present")
    if not configured:
        issues.append("livekit_unconfigured")
    else:
        if citizen_on and str(row.citizen_user_id) not in lk_identities:
            issues.append("citizen_not_in_livekit")
        if lawyer_on and str(row.lawyer_user_id) not in lk_identities:
            issues.append("lawyer_not_in_livekit")
    es = getattr(row, "emergency_status", None) or "none"
    if es in {"open", "ack"}:
        issues.append("active_emergency")
    if call_session and call_session.status == "ringing":
        issues.append("call_stuck_ringing")
    if seconds_until_end(row) < 300 and join_phase(row) == "joinable":
        issues.append("window_expiring")

    return SessionHealthOut(
        appointment_id=str(row.id),
        status=row.status,
        join_state=join_phase(row),
        citizen=party_health(row.citizen_user_id, citizen_on),
        lawyer=party_health(row.lawyer_user_id, lawyer_on),
        livekit={
            "configured": configured,
            "mode": mode,
            "room": room_name,
            "participant_count": len(lk_participants),
            "participants": lk_participants,
        },
        call=call_info,
        summon=summon_info,
        emergency={
            "status": es,
            "reason": getattr(row, "emergency_reason", None) or "",
            "ack_at": _iso(getattr(row, "emergency_ack_at", None)),
        },
        diagnostics={"issues": issues},
    )


@admin_router.get("/appointments/{appointment_id}/session-health", response_model=SessionHealthOut)
async def admin_session_health(
    appointment_id: uuid.UUID,
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SessionHealthOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return await _session_health(repo, row)


@admin_router.post("/appointments/{appointment_id}/observe-token", response_model=RoomTokenOut)
async def admin_observe_token(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RoomTokenOut:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    admin_id = uuid.UUID(user.user_id)
    await repo.upsert_participant(row.id, admin_id, "admin", bump_join=False)
    if not getattr(row, "assigned_admin_user_id", None):
        row.assigned_admin_user_id = admin_id
    await repo.add_event(row.id, "admin_observe", admin_id, {})
    room_name = row.livekit_room or f"apt-{row.id}"
    admin_name = f"Ops · {user.user_id[:8]}"
    minted = mint_observe_token(room=room_name, identity=user.user_id, name=admin_name)
    if not minted:
        return RoomTokenOut(url=None, token=None, room=room_name, configured=False, mode="polling")
    token, url = minted
    return RoomTokenOut(url=url, token=token, room=room_name, configured=True, mode="livekit")


@admin_router.post("/appointments/{appointment_id}/call/reset")
async def admin_reset_call(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict:
    repo = MarketplaceRepository(session)
    row = await repo.get_consultation(appointment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    session_obj = get_active_call(row.id)
    if session_obj:
        await _emit_call_event(row, "call_cancelled", session_obj)
        _ACTIVE_CALLS.pop(str(row.id), None)
    else:
        end_call(row.id)
    await _emit_ops_update(repo, row, user)
    return {"ok": True}


@admin_router.get("/ops-events")
async def admin_ops_events(
    _: CurrentUser = Depends(get_current_user),
) -> StreamingResponse:
    queue = subscribe_admin()

    async def gen():
        try:
            yield f"data: {json.dumps({'type': 'join', 'payload': {}})}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(event, default=str)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            unsubscribe_admin(queue)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@admin_router.get("/lawyers")
async def admin_list_lawyers(
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[LawyerPublic]:
    repo = MarketplaceRepository(session)
    lawyers = await repo.list_all_lawyers()
    return [_lawyer_public(l, match_score=score_lawyer(l)) for l in lawyers]


@admin_router.patch("/lawyers/{lawyer_id}")
async def admin_patch_lawyer(
    lawyer_id: uuid.UUID,
    body: AdminLawyerPatch,
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> LawyerPublic:
    repo = MarketplaceRepository(session)
    lawyer = await repo.get_lawyer(lawyer_id)
    if not lawyer:
        raise HTTPException(status_code=404, detail="Lawyer not found")
    lawyer.is_verified = body.is_verified
    return _lawyer_public(lawyer, match_score=score_lawyer(lawyer))
