"""Request and response schemas for the lawyer-marketplace API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CreateLawyerRequest(BaseModel):
    user_id: str
    full_name: str
    bar_council_id: str | None = None
    practice_areas: list[str] = Field(default_factory=list)
    jurisdictions: list[str] = Field(default_factory=list)
    years_experience: int = 0
    languages: list[str] = Field(default_factory=list)
    hourly_rate: float | None = None
    bio: str | None = None
    is_verified: bool = False


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


class BookAppointmentRequest(BaseModel):
    lawyer_id: str
    date: str
    time_slot: str
    matter_summary: str = Field(min_length=10)
    source: str = "manual"
    citizen_name: str = "Citizen"


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
    full_name: str | None = None
    bar_council_id: str | None = None
    practice_areas: list[str] | None = None
    jurisdictions: list[str] | None = None
    languages: list[str] | None = None
    city: str | None = None
    years_experience: int | None = Field(default=None, ge=0, le=70)
    hourly_rate: float | None = Field(default=None, ge=0)
    bio: str | None = None


class CallEventRequest(BaseModel):
    type: str = Field(pattern="^(started|ended)$")
    talk_seconds: int = Field(default=0, ge=0, le=86400)


class AdminLawyerPatch(BaseModel):
    is_verified: bool


class ReasonRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class EmergencyRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class PriorityRequest(BaseModel):
    priority: str = Field(pattern="^(normal|urgent|emergency)$")


class ExtendRequest(BaseModel):
    minutes: int = Field(ge=1, le=60)


class ReassignRequest(BaseModel):
    lawyer_id: str


class SystemMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class AdminEventOut(BaseModel):
    id: str
    type: str
    actor_user_id: str | None = None
    payload: dict = {}
    created_at: str | None = None
