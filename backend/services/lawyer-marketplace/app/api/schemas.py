"""Request and response schemas for the lawyer-marketplace API."""

from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, Field


class MatchRequest(BaseModel):
    practice_areas: list[str] = Field(default_factory=list)
    jurisdictions: list[str] = Field(default_factory=list)
    city: str | None = None
    limit: int = Field(default=3, ge=1, le=10)


class LawyerMatchResult(BaseModel):
    id: str
    full_name: str
    bar_council_id: str | None
    practice_areas: list[str]
    jurisdictions: list[str]
    years_experience: int
    languages: list[str]
    rating: float
    rating_count: int
    hourly_rate: float | None
    is_verified: bool
    summary: str
    match_score: float = 1.0
    ai_recommended: bool = True


class SummaryResponse(BaseModel):
    lawyer_id: str
    summary: str


class BatchSummaryResponse(BaseModel):
    generated: int
    skipped: int


class LawyerPublic(BaseModel):
    id: str
    slug: str | None = None
    user_id: str
    full_name: str
    bar_council_id: str | None = None
    practice_areas: list[str] = []
    city: str = ""
    pincode: str = ""
    location_state: str = ""
    jurisdictions: list[str] = []
    languages: list[str] = []
    years_experience: int = 0
    rating: float = 0
    rating_count: int = 0
    hourly_rate: float | None = None
    is_verified: bool = False
    bio: str = ""
    summary: str = ""
    match_score: int = 0
    ai_recommended: bool = False
    verification_data: dict | None = None
    verified_at: str | None = None
    photo_url: str | None = None
    # Shown in the advocate listing only when nothing is missing for it; in
    # Saarthi's AI recommendations only when nothing is missing for matching.
    listed: bool = False
    missing_for_listing: list[str] = []
    missing_for_matching: list[str] = []
    # Mandatory details not yet filled in (API field names) — see listing_rules.
    missing_required: list[str] = []
    practising_since: int | None = None


class ParticipantModeration(BaseModel):
    status: str = "none"
    suspended_until: str | None = None
    reason: str = ""


class BookAppointmentRequest(BaseModel):
    lawyer_id: str
    date: str
    time_slot: str
    matter_summary: str = Field(min_length=10)
    source: str = "manual"
    citizen_name: str = "Citizen"
    case_id: str | None = None


class AppointmentOut(BaseModel):
    id: str
    lawyer_id: str
    lawyer_name: str
    lawyer_slug: str | None = None
    citizen_user_id: str
    lawyer_user_id: str
    citizen_name: str
    counterpart_name: str
    my_role: str = "citizen"
    livekit_room: str | None = None
    date: str
    time_slot: str
    scheduled_at: str | None
    scheduled_end_at: str | None
    matter_summary: str
    status: str
    source: str
    join_state: str
    seconds_until_start: int
    seconds_until_end: int
    opponent_present: bool = False
    pending_summon: bool = False
    created_at: str
    metrics: dict = {}
    priority: str = "normal"
    emergency_status: str = "none"
    emergency_reason: str = ""
    emergency_at: str | None = None
    emergency_ack_at: str | None = None
    emergency_resolved_at: str | None = None
    assigned_admin_user_id: str | None = None
    ops_note: str = ""
    citizen_present: bool = False
    lawyer_present: bool = False
    last_summon_at: str | None = None
    prior_join: bool = False
    citizen_moderation: ParticipantModeration = Field(default_factory=lambda: ParticipantModeration())
    lawyer_moderation: ParticipantModeration = Field(default_factory=lambda: ParticipantModeration())
    case_id: str | None = None


class IncomingCallPayload(BaseModel):
    call_id: str
    appointment_id: str
    mode: Literal["audio", "video"]
    caller_user_id: str
    caller_name: str
    started_at: str | None = None
    status: str = "ringing"


class JoinStateOut(BaseModel):
    appointment_id: str
    join_state: str
    seconds_until_start: int
    seconds_until_end: int
    opponent_present: bool
    pending_summon: bool
    opponent_typing: bool = False
    status: str
    scheduled_at: str | None
    scheduled_end_at: str | None
    priority: str = "normal"
    emergency_status: str = "none"
    emergency_reason: str = ""
    last_summon_at: str | None = None
    prior_join: bool = False
    pending_incoming_call: IncomingCallPayload | None = None


class AttachmentOut(BaseModel):
    id: str
    consultation_id: str
    sender_user_id: str
    receiver_user_id: str
    filename: str
    content_type: str
    size_bytes: int
    kind: str
    url: str
    created_at: str


class MessageOut(BaseModel):
    id: str
    sender_user_id: str
    sender_role: str
    body: str
    created_at: str
    reactions: dict = {}
    kind: str = "text"
    attachment_id: str | None = None
    attachment: AttachmentOut | None = None


class PostMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ReactionRequest(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)


class TypingRequest(BaseModel):
    on: bool = True


class RoomTokenOut(BaseModel):
    url: str | None = None
    token: str | None = None
    room: str
    configured: bool = False
    mode: str = "polling"


class TranscriptOut(BaseModel):
    appointment: AppointmentOut
    messages: list[MessageOut]


class LawyerMeUpdate(BaseModel):
    """Omitted (None) fields are left unchanged. Format rules apply to every
    field sent; completeness is checked on the resulting listing (listing_rules)."""

    full_name: str | None = Field(default=None, max_length=255)
    bar_council_id: str | None = Field(default=None, max_length=120)
    practice_areas: list[str] | None = Field(default=None, max_length=20)
    jurisdictions: list[str] | None = Field(default=None, max_length=30)
    languages: list[str] | None = Field(default=None, max_length=15)
    city: str | None = Field(default=None, max_length=80)
    pincode: str | None = Field(default=None, pattern=r"^([1-9][0-9]{5})?$")
    location_state: str | None = Field(default=None, max_length=100)
    years_experience: int | None = Field(default=None, ge=0, le=70)
    hourly_rate: float | None = Field(default=None, gt=0, multiple_of=1)  # whole rupees, per consultation
    bio: str | None = Field(default=None, max_length=3000)


class CallEventRequest(BaseModel):
    type: str = Field(pattern="^(started|ended)$")
    talk_seconds: int = Field(default=0, ge=0, le=86400)


class CallRingRequest(BaseModel):
    mode: Literal["audio", "video"]


class CallRespondRequest(BaseModel):
    call_id: str
    action: Literal["accept", "decline"]


class CallCancelRequest(BaseModel):
    call_id: str


class AdminLawyerPatch(BaseModel):
    is_verified: bool
    note: str | None = Field(default=None, max_length=500)


class VerifyRequest(BaseModel):
    state: str | None = None


class MeVerifyRequest(BaseModel):
    enrollment_number: str = Field(min_length=1, max_length=120)
    # "other" = a Bar Council Satyapan can't check yet → manual review.
    state: str | None = None
    # The advocate asks our team to check (e.g. not found on the roll).
    manual_review: bool = False


class ReviewVerificationRequest(BaseModel):
    decision: Literal["approve", "reject"]
    note: str | None = Field(default=None, max_length=500)


class VerifyResponse(BaseModel):
    lawyer_id: uuid.UUID
    status: str
    message: str
    is_verified: bool
    verified_at: str | None
    data: dict | None = None


class ReasonRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class PriorityRequest(BaseModel):
    priority: str = Field(pattern="^(normal|urgent|emergency)$")


class ExtendRequest(BaseModel):
    minutes: int = Field(ge=1, le=60)


class ReassignRequest(BaseModel):
    lawyer_id: str
    reason: str = Field(default="", max_length=500)


class DurationRequest(BaseModel):
    scheduled_end_at: str | None = None
    minutes_delta: int | None = Field(default=None, ge=-60, le=120)


class ActivityLogOut(BaseModel):
    id: str
    type: str
    actor_user_id: str | None = None
    actor_name: str = ""
    actor_role: str = ""
    summary: str = ""
    payload: dict = {}
    created_at: str | None = None


class ActivityLogPageOut(BaseModel):
    items: list[ActivityLogOut]
    total: int
    page: int
    size: int


class SystemMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ModerateKickRequest(BaseModel):
    target: Literal["citizen", "lawyer"]
    reason: str = Field(default="", max_length=500)


class ModerateSuspendRequest(BaseModel):
    target: Literal["citizen", "lawyer"]
    minutes: Literal[5, 15, 30]
    reason: str = Field(min_length=3, max_length=500)


class ModerateUnsuspendRequest(BaseModel):
    target: Literal["citizen", "lawyer"]


class EmergencyRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class LiveKitParticipantOut(BaseModel):
    identity: str
    name: str = ""
    role: str = ""


class PartyHealthOut(BaseModel):
    present: bool = False
    last_seen_at: str | None = None
    moderation: ParticipantModeration = Field(default_factory=lambda: ParticipantModeration())
    livekit_connected: bool = False


class SessionHealthOut(BaseModel):
    appointment_id: str
    status: str
    join_state: str
    citizen: PartyHealthOut
    lawyer: PartyHealthOut
    livekit: dict = {}
    call: dict | None = None
    summon: dict | None = None
    emergency: dict = {}
    diagnostics: dict = Field(default_factory=lambda: {"issues": []})


class AdminEventOut(BaseModel):
    id: str
    type: str
    actor_user_id: str | None = None
    payload: dict = {}
    created_at: str | None = None
