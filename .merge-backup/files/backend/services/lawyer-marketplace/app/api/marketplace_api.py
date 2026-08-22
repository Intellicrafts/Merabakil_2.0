"""JWT-protected lawyer listing and appointment APIs."""

from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import (
    AdminEventOut,
    AdminLawyerPatch,
    AppointmentOut,
    AttachmentOut,
    BookAppointmentRequest,
    CallEventRequest,
    EmergencyRequest,
    ExtendRequest,
    JoinStateOut,
    LawyerMeUpdate,
    LawyerPublic,
    MatchRequest,
    MessageOut,
    PostMessageRequest,
    PriorityRequest,
    ReactionRequest,
    ReasonRequest,
    ReassignRequest,
    RoomTokenOut,
    SystemMessageRequest,
    TranscriptOut,
    TypingRequest,
)
from app.application.appointments import (
    book,
    join_phase,
    now_ist,
    opponent_typing,
    pending_summon,
    promote_live_if_active,
    refresh_status,
    seconds_until_end,
    seconds_until_start,
    set_typing,
)
from app.application.livekit_tokens import mint_room_token
from app.application.matching import score_lawyer
from app.application.room_hub import publish, publish_admin, publish_user, subscribe, subscribe_admin, subscribe_user, unsubscribe, unsubscribe_admin, unsubscribe_user
from app.constants import PRIORITIES
from app.infrastructure.appointment_models import Consultation
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
from legalos_common.security.rbac import CurrentUser, get_current_user, require_roles

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


async def _emit_ops_update(
    repo: MarketplaceRepository,
    row: Consultation,
    user: CurrentUser,
) -> None:
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "ops_update", out.model_dump())


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
    _: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[LawyerPublic]:
    repo = MarketplaceRepository(session)
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
    user: CurrentUser = Depends(get_current_user),
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
    return await _to_appointment(repo, row, user, lawyer=lawyer)


@appointments_router.get("", response_model=list[AppointmentOut])
async def list_appointments(
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[AppointmentOut]:
    repo = MarketplaceRepository(session)
    uid = uuid.UUID(user.user_id)
    lawyer_row = await repo.get_lawyer_by_user(uid)
    as_lawyer = lawyer_row is not None or user.has_role("advocate")
    rows = await repo.list_consultations_for_user(uid, as_lawyer=as_lawyer)
    if as_lawyer and not rows:
        rows = await repo.list_consultations_for_user(uid, as_lawyer=False)
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
    return await _to_appointment(repo, row, user)


@appointments_router.post("/{appointment_id}/cancel", response_model=AppointmentOut)
async def cancel_appointment(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    if row.status in {"completed", "expired", "no_show"}:
        raise HTTPException(status_code=400, detail="Appointment already closed")
    row.status = "cancelled"
    await repo.add_event(row.id, "cancelled", uuid.UUID(user.user_id), {})
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
    if join_phase(row) == "expired" and row.status not in {"live"}:
        raise HTTPException(status_code=403, detail="Chat is closed")
    msg = await repo.add_message(
        consultation_id=row.id,
        sender_user_id=uuid.UUID(user.user_id),
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
    await _load(repo, appointment_id, user)
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
    if join_phase(row) == "expired" and row.status not in {"live"}:
        raise HTTPException(status_code=403, detail="Chat is closed")
    raw = await file.read()
    filename = file.filename or "file"
    error = validate_upload(filename=filename, content_type=file.content_type or "", size=len(raw))
    if error:
        raise HTTPException(status_code=400, detail=error)
    sender_id = uuid.UUID(user.user_id)
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
    return {"ok": True, "metrics": metrics}


async def _ops_snapshot(
    repo: MarketplaceRepository, row: Consultation, user: CurrentUser
) -> AppointmentOut:
    lawyer = await repo.get_lawyer(row.lawyer_id)
    return await _to_appointment(repo, row, user, lawyer=lawyer)


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
        raise HTTPException(status_code=403, detail="Only appointment parties can request help")
    instant = now_ist()
    row.priority = "emergency"
    row.emergency_status = "open"
    row.emergency_reason = body.reason.strip()
    row.emergency_at = instant
    row.emergency_ack_at = None
    row.emergency_resolved_at = None
    row.assigned_admin_user_id = None
    actor = uuid.UUID(user.user_id)
    await repo.add_event(
        row.id,
        "emergency_opened",
        actor,
        {"reason": row.emergency_reason, "role": _role_for(user, row)},
    )
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "emergency", out.model_dump())
    await _emit(row.id, "ops_update", out.model_dump())
    return out


@appointments_router.post("/{appointment_id}/emergency/resolve", response_model=AppointmentOut)
async def party_resolve_emergency(
    appointment_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> AppointmentOut:
    repo = MarketplaceRepository(session)
    row = await _load(repo, appointment_id, user)
    if user.has_role("admin"):
        raise HTTPException(status_code=403, detail="Use admin resolve")
    if row.emergency_status not in {"open", "ack"}:
        raise HTTPException(status_code=400, detail="No active emergency")
    row.emergency_status = "resolved"
    row.emergency_resolved_at = now_ist()
    await repo.add_event(row.id, "emergency_resolved", uuid.UUID(user.user_id), {"by": "party"})
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "emergency", out.model_dump())
    await _emit(row.id, "ops_update", out.model_dump())
    return out


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
    events = [_event_out(e) for e in await repo.list_events(row.id)]
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
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "ops_update", out.model_dump())
    return out


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
    if row.emergency_status not in {"open", "ack"}:
        raise HTTPException(status_code=400, detail="No active emergency")
    admin_id = uuid.UUID(user.user_id)
    row.emergency_status = "ack"
    row.emergency_ack_at = now_ist()
    row.assigned_admin_user_id = admin_id
    await repo.add_event(row.id, "emergency_acked", admin_id, {})
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "emergency", out.model_dump())
    await _emit(row.id, "ops_update", out.model_dump())
    return out


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
    if row.emergency_status not in {"open", "ack"}:
        raise HTTPException(status_code=400, detail="No active emergency")
    row.emergency_status = "resolved"
    row.emergency_resolved_at = now_ist()
    await repo.add_event(row.id, "emergency_resolved", uuid.UUID(user.user_id), {"by": "admin"})
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "emergency", out.model_dump())
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
    prev = {
        "lawyer_id": str(row.lawyer_id),
        "lawyer_user_id": str(row.lawyer_user_id),
        "lawyer_name": row.lawyer_display_name,
    }
    row.lawyer_id = lawyer.id
    row.lawyer_user_id = lawyer.user_id
    row.lawyer_display_name = lawyer.full_name
    await repo.add_event(row.id, "reassigned", uuid.UUID(user.user_id), {"from": prev, "to": {"lawyer_id": str(lawyer.id), "lawyer_name": lawyer.full_name}})
    out = await _ops_snapshot(repo, row, user)
    await _emit(row.id, "ops_update", out.model_dump())
    return out


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
