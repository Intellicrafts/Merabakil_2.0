"""Auth + user management HTTP routes."""

from __future__ import annotations

import hashlib
import uuid

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from fastapi.responses import JSONResponse, Response

from app.api.deps import enforce_rate_limit, get_auth_service, get_auth_settings
from app.api.schemas import (
    AuthResponse,
    EmailHealthResponse,
    GoogleAuthRequest,
    GoogleCompleteRequest,
    GoogleNeedsRoleResponse,
    LoginRequest,
    MessageResponse,
    OtpSendRequest,
    OtpSendResponse,
    OtpVerifyRegisterResponse,
    OtpVerifyRequest,
    PasswordResetConfirm,
    PasswordResetIssued,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    AvatarUploadResponse,
    CitizenProfileResponse,
    CitizenProfileUpdate,
    UpdateUserRequest,
    UserConsentResponse,
    UserResponse,
)
from app.application.use_cases import (
    AuthResult,
    AuthService,
    GoogleNeedsRoleResult,
    OtpVerifyRegisterResult,
)
from legalos_common.api.pagination import Page, PageParams, paginate
from legalos_common.security.rbac import (
    CurrentUser,
    Permission,
    get_current_user,
    require_permissions,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
users_router = APIRouter(prefix="/api/v1/users", tags=["users"])


def _to_auth_response(result: AuthResult) -> AuthResponse:
    return AuthResponse(
        user=UserResponse(
            user_id=result.user_id,
            email=result.email,
            full_name=result.full_name,
            roles=result.roles,
            permissions=result.permissions,
            avatar_url=None,
        ),
        tokens=TokenResponse(
            access_token=result.tokens.access_token,
            refresh_token=result.tokens.refresh_token,
        ),
    )


async def _to_auth_response_with_avatar(result: AuthResult, service: AuthService) -> AuthResponse:
    db_user = await service.get_user(uuid.UUID(result.user_id))
    return AuthResponse(
        user=_to_user_response(db_user, service),
        tokens=TokenResponse(
            access_token=result.tokens.access_token,
            refresh_token=result.tokens.refresh_token,
        ),
    )


def _to_user_response(user, service: AuthService) -> UserResponse:
    return UserResponse(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        roles=user.role_names,
        permissions=user.permission_codes,
        avatar_url=service.resolve_avatar_url(user),
        is_active=getattr(user, "is_active", True),
        created_at=getattr(user, "created_at", None) and user.created_at.isoformat(),
    )


def _hash_client_ip(request: Request) -> str | None:
    if request.client is None:
        return None
    return hashlib.sha256(request.client.host.encode()).hexdigest()


def _to_google_needs_role_response(result: GoogleNeedsRoleResult) -> GoogleNeedsRoleResponse:
    return GoogleNeedsRoleResponse(
        onboarding_token=result.onboarding_token,
        email=result.email,
        full_name=result.full_name,
        picture=result.picture,
    )


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(enforce_rate_limit)],
    summary="Register a new account",
)
async def register(
    body: RegisterRequest,
    request: Request,
    service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    result = await service.register(
        email=body.email,
        full_name=body.full_name,
        password=body.password,
        verification_token=body.verification_token,
        role=body.role.value,
        terms_version=body.terms_version,
        privacy_version=body.privacy_version,
        ip_hash=_hash_client_ip(request),
    )
    return await _to_auth_response_with_avatar(result, service)


@router.post(
    "/otp/send",
    response_model=OtpSendResponse,
    dependencies=[Depends(enforce_rate_limit)],
    summary="Send a one-time verification code to an email",
)
async def send_otp(
    body: OtpSendRequest,
    service: AuthService = Depends(get_auth_service),
) -> OtpSendResponse:
    result = await service.send_otp(email=body.email, purpose=body.purpose)
    return OtpSendResponse(message=result.message)


@router.post(
    "/otp/verify",
    dependencies=[Depends(enforce_rate_limit)],
    summary="Verify a one-time code for registration or login",
)
async def verify_otp(
    body: OtpVerifyRequest,
    service: AuthService = Depends(get_auth_service),
):
    result = await service.verify_otp(
        email=body.email, purpose=body.purpose, code=body.code
    )
    if isinstance(result, OtpVerifyRegisterResult):
        return OtpVerifyRegisterResponse(verification_token=result.verification_token)
    return await _to_auth_response_with_avatar(result, service)


@router.get(
    "/email/health",
    response_model=EmailHealthResponse,
    summary="SMTP configuration health (admin)",
)
async def email_health(
    service: AuthService = Depends(get_auth_service),
    _: CurrentUser = Depends(require_permissions(Permission.USER_MANAGE.value)),
) -> EmailHealthResponse:
    status = service.email_health()
    return EmailHealthResponse(**status)


@router.post(
    "/login",
    response_model=AuthResponse,
    dependencies=[Depends(enforce_rate_limit)],
    summary="Authenticate and receive tokens",
)
async def login(
    body: LoginRequest,
    service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    result = await service.authenticate(email=body.email, password=body.password)
    return await _to_auth_response_with_avatar(result, service)


@router.post(
    "/google",
    dependencies=[Depends(enforce_rate_limit)],
    summary="Authenticate with Google Identity Services credential",
)
async def google_auth(
    body: GoogleAuthRequest,
    service: AuthService = Depends(get_auth_service),
):
    result = await service.authenticate_with_google(id_token=body.id_token)
    if isinstance(result, GoogleNeedsRoleResult):
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=_to_google_needs_role_response(result).model_dump(),
        )
    return await _to_auth_response_with_avatar(result, service)


@router.post(
    "/google/complete",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(enforce_rate_limit)],
    summary="Complete Google registration with role selection",
)
async def google_complete(
    body: GoogleCompleteRequest,
    request: Request,
    service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    result = await service.complete_google_registration(
        onboarding_token=body.onboarding_token,
        role=body.role.value,
        terms_version=body.terms_version,
        privacy_version=body.privacy_version,
        ip_hash=_hash_client_ip(request),
    )
    return await _to_auth_response_with_avatar(result, service)


@router.post("/refresh", response_model=TokenResponse, summary="Rotate refresh token")
async def refresh(
    body: RefreshRequest,
    service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    tokens = await service.refresh(refresh_token=body.refresh_token)
    return TokenResponse(access_token=tokens.access_token, refresh_token=tokens.refresh_token)


@router.post(
    "/password-reset",
    response_model=PasswordResetIssued,
    dependencies=[Depends(enforce_rate_limit)],
    summary="Request a password reset token",
)
async def request_password_reset(
    body: PasswordResetRequest,
    service: AuthService = Depends(get_auth_service),
) -> PasswordResetIssued:
    token = await service.request_password_reset(email=body.email)
    settings = get_auth_settings()
    expose = token if settings.environment != "production" else None
    return PasswordResetIssued(
        message="If the account exists, a reset link has been sent.",
        reset_token=expose,
    )


@router.post(
    "/password-reset/confirm",
    response_model=MessageResponse,
    summary="Complete a password reset",
)
async def confirm_password_reset(
    body: PasswordResetConfirm,
    service: AuthService = Depends(get_auth_service),
) -> MessageResponse:
    await service.reset_password(token=body.token, new_password=body.new_password)
    return MessageResponse(message="Password updated successfully.")


def _to_citizen_profile_response(profile) -> CitizenProfileResponse:
    return CitizenProfileResponse(
        full_name=profile.full_name,
        email=profile.email,
        phone=profile.phone,
        date_of_birth=profile.date_of_birth,
        address=profile.address,
        avatar_url=profile.avatar_url,
    )


@users_router.get("/me", response_model=UserResponse, summary="Current user profile")
async def me(
    current: CurrentUser = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    user = await service.get_user(uuid.UUID(current.user_id))
    return _to_user_response(user, service)


@users_router.get(
    "/me/profile",
    response_model=CitizenProfileResponse,
    summary="Get citizen profile details",
)
async def get_my_profile(
    current: CurrentUser = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> CitizenProfileResponse:
    profile = await service.get_citizen_profile(uuid.UUID(current.user_id))
    return _to_citizen_profile_response(profile)


@users_router.patch(
    "/me/profile",
    response_model=CitizenProfileResponse,
    summary="Update citizen profile details",
)
async def update_my_profile(
    body: CitizenProfileUpdate,
    current: CurrentUser = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> CitizenProfileResponse:
    profile = await service.update_citizen_profile(
        uuid.UUID(current.user_id),
        full_name=body.full_name,
        phone=body.phone,
        date_of_birth=body.date_of_birth,
        address=body.address,
        fields_set=body.model_fields_set,
    )
    return _to_citizen_profile_response(profile)


@users_router.post(
    "/me/avatar",
    response_model=AvatarUploadResponse,
    summary="Upload profile photo",
)
async def upload_my_avatar(
    file: UploadFile = File(...),
    current: CurrentUser = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> AvatarUploadResponse:
    raw = await file.read()
    content_type = file.content_type or "application/octet-stream"
    avatar_url = await service.upload_avatar(
        uuid.UUID(current.user_id),
        raw=raw,
        content_type=content_type,
    )
    return AvatarUploadResponse(avatar_url=avatar_url)


@users_router.delete(
    "/me/avatar",
    response_model=MessageResponse,
    summary="Remove profile photo",
)
async def delete_my_avatar(
    current: CurrentUser = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> MessageResponse:
    await service.delete_avatar(uuid.UUID(current.user_id))
    return MessageResponse(message="Profile photo removed.")


@users_router.get("/me/avatar", summary="Download current user profile photo")
async def get_my_avatar(
    current: CurrentUser = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> Response:
    data, content_type = await service.get_avatar_file(uuid.UUID(current.user_id))
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "private, max-age=300"})


@users_router.get(
    "/me/consents",
    response_model=list[UserConsentResponse],
    summary="Current user consent records",
)
async def my_consents(
    current: CurrentUser = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> list[UserConsentResponse]:
    consents = await service.list_user_consents(uuid.UUID(current.user_id))
    return [
        UserConsentResponse(
            consent_type=c.consent_type,
            version=c.version,
            accepted_at=c.accepted_at.isoformat(),
        )
        for c in consents
    ]


@users_router.get(
    "",
    response_model=Page[UserResponse],
    summary="List users (admin)",
)
async def list_users(
    params: PageParams = Depends(PageParams.as_query),
    search: str | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    role: str | None = Query(default=None),
    _: CurrentUser = Depends(require_permissions(Permission.USER_MANAGE.value)),
    service: AuthService = Depends(get_auth_service),
) -> Page[UserResponse]:
    users, total = await service.list_users(
        offset=params.offset, limit=params.size, search=search, is_active=is_active, role=role
    )
    items = [_to_user_response(u, service) for u in users]
    return paginate(items, total, params)


@users_router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get a user by id (admin)",
)
async def get_user(
    user_id: uuid.UUID,
    _: CurrentUser = Depends(require_permissions(Permission.USER_MANAGE.value)),
    service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    user = await service.get_user(user_id)
    return _to_user_response(user, service)


@users_router.patch(
    "/{user_id}",
    response_model=UserResponse,
    summary="Update a user (admin)",
)
async def update_user(
    user_id: uuid.UUID,
    body: UpdateUserRequest,
    _: CurrentUser = Depends(require_permissions(Permission.USER_MANAGE.value)),
    service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    user = await service.update_user(user_id, full_name=body.full_name, is_active=body.is_active)
    return _to_user_response(user, service)
