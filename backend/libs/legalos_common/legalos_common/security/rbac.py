"""Reusable JWT auth + RBAC dependencies for FastAPI services.

Services that own the user database issue tokens; *every* service can validate
them and enforce role/permission requirements without a network round-trip,
because roles and permissions are embedded as signed claims.
"""

from __future__ import annotations

from enum import StrEnum

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from pydantic import BaseModel

from legalos_common.security.jwt import TokenType, decode_token

bearer_scheme = HTTPBearer(auto_error=True)


class Role(StrEnum):
    ADMIN = "admin"
    ADVOCATE = "advocate"
    LAW_FIRM = "law_firm"
    ENTERPRISE = "enterprise"
    CITIZEN = "citizen"


class Permission(StrEnum):
    # Knowledge / research
    RESEARCH_READ = "research:read"
    KNOWLEDGE_INGEST = "knowledge:ingest"
    SEARCH_READ = "search:read"
    # Cases
    CASE_READ = "case:read"
    CASE_WRITE = "case:write"
    # Courtroom simulation
    COURTROOM_SIMULATE = "courtroom:simulate"
    # Documents
    DOCUMENT_READ = "document:read"
    DOCUMENT_WRITE = "document:write"
    # Administration
    USER_MANAGE = "user:manage"
    ROLE_MANAGE = "role:manage"
    AUDIT_READ = "audit:read"


class CurrentUser(BaseModel):
    user_id: str
    roles: list[str]
    permissions: list[str]

    def has_role(self, role: str) -> bool:
        return role in self.roles or Role.ADMIN.value in self.roles

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions or Role.ADMIN.value in self.roles


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    try:
        payload = decode_token(credentials.credentials, expected_type=TokenType.ACCESS)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return CurrentUser(
        user_id=payload.sub,
        roles=payload.roles,
        permissions=payload.permissions,
    )


def require_roles(*roles: str):
    """Dependency factory enforcing that the user has at least one of ``roles``."""

    async def _dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not any(user.has_role(r) for r in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role privileges",
            )
        return user

    return _dependency


def require_permissions(*permissions: str):
    """Dependency factory enforcing that the user holds all ``permissions``."""

    async def _dependency(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if not all(user.has_permission(p) for p in permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return _dependency
