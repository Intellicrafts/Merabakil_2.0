"""Add one-to-one profile records for every self-service account role.

The ``users`` table remains the canonical identity record.  These tables carry
role-specific data and use ``user_id`` as both their primary key and foreign
key, making it impossible for a profile to belong to more than one user.

Revision ID: 0005_role_profiles
Revises: 0004_lawyer_summary
Create Date: 2026-08-22
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0005_role_profiles"
down_revision: str | None = "0004_lawyer_summary"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE citizen_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            phone VARCHAR(30),
            date_of_birth DATE,
            address TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE law_firm_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            firm_name VARCHAR(255) NOT NULL,
            registration_number VARCHAR(120),
            office_address TEXT,
            practice_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
            jurisdictions JSONB NOT NULL DEFAULT '[]'::jsonb,
            team_size INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE enterprise_profiles (
            user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            organization_name VARCHAR(255) NOT NULL,
            registration_number VARCHAR(120),
            industry VARCHAR(120),
            office_address TEXT,
            employee_count INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- The pre-existing lawyers table is the advocate profile table.  One
        -- advocate account may own exactly one marketplace profile.
        ALTER TABLE lawyers
            ADD CONSTRAINT uq_lawyers_user_id UNIQUE (user_id);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE lawyers DROP CONSTRAINT IF EXISTS uq_lawyers_user_id;
        DROP TABLE IF EXISTS enterprise_profiles;
        DROP TABLE IF EXISTS law_firm_profiles;
        DROP TABLE IF EXISTS citizen_profiles;
        """
    )
