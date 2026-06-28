"""Seed default roles, permissions, role-permission bindings and an admin user.

Idempotent: safe to run multiple times. Invoked via ``make seed``.
"""

from __future__ import annotations

import asyncio
import os

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.infrastructure.db import session_manager
from app.infrastructure.models import Permission as PermissionModel
from app.infrastructure.models import Role as RoleModel
from app.infrastructure.models import User
from legalos_common.logging import configure_logging, get_logger
from legalos_common.security.passwords import hash_password
from legalos_common.security.rbac import Permission, Role

logger = get_logger("auth.seed")

ROLE_PERMISSIONS: dict[Role, list[Permission]] = {
    Role.ADMIN: list(Permission),
    Role.ADVOCATE: [
        Permission.RESEARCH_READ,
        Permission.SEARCH_READ,
        Permission.KNOWLEDGE_INGEST,
        Permission.CASE_READ,
        Permission.CASE_WRITE,
        Permission.DOCUMENT_READ,
        Permission.DOCUMENT_WRITE,
    ],
    Role.LAW_FIRM: [
        Permission.RESEARCH_READ,
        Permission.SEARCH_READ,
        Permission.KNOWLEDGE_INGEST,
        Permission.CASE_READ,
        Permission.CASE_WRITE,
        Permission.DOCUMENT_READ,
        Permission.DOCUMENT_WRITE,
    ],
    Role.ENTERPRISE: [
        Permission.RESEARCH_READ,
        Permission.SEARCH_READ,
        Permission.DOCUMENT_READ,
        Permission.DOCUMENT_WRITE,
    ],
    Role.CITIZEN: [
        Permission.RESEARCH_READ,
        Permission.SEARCH_READ,
    ],
}


async def seed() -> None:
    configure_logging("auth-seed", "INFO")
    settings = get_settings()
    admin_email = os.getenv("SEED_ADMIN_EMAIL", "admin@legalos.in")
    admin_password = os.getenv("SEED_ADMIN_PASSWORD", "ChangeMe!2026")

    async with session_manager.session() as session:
        # Permissions
        perm_models: dict[str, PermissionModel] = {}
        for perm in Permission:
            existing = (
                await session.execute(
                    select(PermissionModel).where(PermissionModel.code == perm.value)
                )
            ).scalar_one_or_none()
            if existing is None:
                existing = PermissionModel(code=perm.value, description=perm.name)
                session.add(existing)
            perm_models[perm.value] = existing
        await session.flush()

        # Roles
        for role, perms in ROLE_PERMISSIONS.items():
            role_model = (
                await session.execute(select(RoleModel).where(RoleModel.name == role.value))
            ).scalar_one_or_none()
            if role_model is None:
                role_model = RoleModel(name=role.value, description=f"{role.name} role")
                session.add(role_model)
            role_model.permissions = [perm_models[p.value] for p in perms]
        await session.flush()

        # Admin user
        admin_role = (
            await session.execute(select(RoleModel).where(RoleModel.name == Role.ADMIN.value))
        ).scalar_one()

        admin = (
            await session.execute(
                select(User)
                .where(User.email == admin_email)
                .options(selectinload(User.roles))
            )
        ).scalar_one_or_none()
        if admin is None:
            admin = User(
                email=admin_email,
                full_name="Platform Administrator",
                hashed_password=hash_password(admin_password),
                is_active=True,
                is_verified=True,
                roles=[admin_role],
            )
            session.add(admin)
        elif admin_role not in admin.roles:
            admin.roles.append(admin_role)

        await session.commit()
    logger.info("seed_complete", admin_email=admin_email, environment=settings.environment)


if __name__ == "__main__":
    asyncio.run(seed())
