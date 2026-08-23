"""Request/response models for the auth API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from legalos_common.security.rbac import Role


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: Role = Role.CITIZEN


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(min_length=1)


class GoogleCompleteRequest(BaseModel):
    onboarding_token: str = Field(min_length=1)
    role: Role = Role.CITIZEN


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
