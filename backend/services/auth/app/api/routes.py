"""Auth + user management HTTP routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse

from app.api.deps import enforce_rate_limit, get_auth_service, get_auth_settings
from app.api.schemas import (
    AuthResponse,
    GoogleAuthRequest,
    GoogleCompleteRequest,
    GoogleNeedsRoleResponse,
    LoginRequest,
    MessageResponse,
    PasswordResetConfirm,
    PasswordResetIssued,
    PasswordResetRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.application.use_cases import AuthResult, AuthService, GoogleNeedsRoleResult
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
        ),
        tokens=TokenResponse(
            access_token=result.tokens.access_token,
            refresh_token=result.tokens.refresh_token,
        ),
    )


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
    service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    result = await service.register(
        email=body.email,
        full_name=body.full_name,
        password=body.password,
        role=body.role.value,
    )
    return _to_auth_response(result)


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
    return _to_auth_response(result)


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
    return _to_auth_response(result)


@router.post(
    "/google/complete",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(enforce_rate_limit)],
    summary="Complete Google registration with role selection",
)
async def google_complete(
    body: GoogleCompleteRequest,
    service: AuthService = Depends(get_auth_service),
) -> AuthResponse:
    result = await service.complete_google_registration(
        onboarding_token=body.onboarding_token,
        role=body.role.value,
    )
    return _to_auth_response(result)


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


def _to_user_response(user) -> UserResponse:
    return UserResponse(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        roles=user.role_names,
        permissions=user.permission_codes,
    )


@users_router.get("/me", response_model=UserResponse, summary="Current user profile")
async def me(
    current: CurrentUser = Depends(get_current_user),
    service: AuthService = Depends(get_auth_service),
) -> UserResponse:
    user = await service.get_user(uuid.UUID(current.user_id))
    return _to_user_response(user)


@users_router.get(
    "",
    response_model=Page[UserResponse],
    summary="List users (admin)",
)
async def list_users(
    params: PageParams = Depends(PageParams.as_query),
    _: CurrentUser = Depends(require_permissions(Permission.USER_MANAGE.value)),
    service: AuthService = Depends(get_auth_service),
) -> Page[UserResponse]:
    users, total = await service.list_users(offset=params.offset, limit=params.size)
    items = [_to_user_response(u) for u in users]
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
    return _to_user_response(user)
