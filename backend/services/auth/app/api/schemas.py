"""Request/response models for the auth API."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from legalos_common.security.rbac import Role


class AcquisitionInput(BaseModel):
    """Ad attribution captured from the landing URL at signup."""

    gclid: str | None = Field(default=None, max_length=512)
    utm_source: str | None = Field(default=None, max_length=255)
    utm_campaign: str | None = Field(default=None, max_length=255)


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    verification_token: str = Field(min_length=1)
    role: Role = Role.CITIZEN
    terms_version: str | None = Field(default=None, max_length=20)
    privacy_version: str | None = Field(default=None, max_length=20)
    acquisition: AcquisitionInput | None = None


class OtpSendRequest(BaseModel):
    email: EmailStr
    purpose: Literal["register", "login"]


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    purpose: Literal["register", "login"]
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class OtpSendResponse(BaseModel):
    message: str


class EmailHealthResponse(BaseModel):
    configured: bool
    from_aligned: bool
    warnings: list[str]
    last_error: str | None = None


class OtpVerifyRegisterResponse(BaseModel):
    verification_token: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=1)


class GoogleCompleteRequest(BaseModel):
    onboarding_token: str = Field(min_length=1)
    role: Role = Role.CITIZEN
    terms_version: str | None = Field(default=None, max_length=20)
    privacy_version: str | None = Field(default=None, max_length=20)
    acquisition: AcquisitionInput | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    roles: list[str]
    permissions: list[str]
    avatar_url: str | None = None
    is_active: bool = True
    created_at: str | None = None


class UpdateUserRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    is_active: bool | None = None


class CitizenProfileResponse(BaseModel):
    full_name: str
    email: str
    phone: str | None = None
    date_of_birth: date | None = None
    address: str | None = None
    avatar_url: str | None = None


class CitizenProfileUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    date_of_birth: date | None = None
    address: str | None = Field(default=None, max_length=2000)


class AvatarUploadResponse(BaseModel):
    avatar_url: str


class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokenResponse


class GoogleNeedsRoleResponse(BaseModel):
    status: Literal["needs_role"] = "needs_role"
    onboarding_token: str
    email: str
    full_name: str
    picture: str | None = None


class MessageResponse(BaseModel):
    message: str


class PasswordResetIssued(BaseModel):
    message: str
    # Present only in non-production to ease local testing.
    reset_token: str | None = None


class UserConsentResponse(BaseModel):
    consent_type: str
    version: str
    accepted_at: str


class NotificationOut(BaseModel):
    id: str
    kind: str
    title: str
    body: str | None
    action_url: str | None
    is_read: bool
    created_at: datetime
