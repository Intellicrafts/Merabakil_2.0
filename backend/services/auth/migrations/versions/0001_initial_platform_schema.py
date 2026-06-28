"""Initial AI Legal OS platform schema.

Creates the complete Phase 1 baseline: auth tables plus the platform tables that
downstream services (case, document, knowledge, marketplace, billing, audit)
read from and write to.

Revision ID: 0001_initial
Revises:
Create Date: 2026-06-25
"""
from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto";')

    # ---- Identity & access -------------------------------------------------
    op.execute(
        """
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            full_name VARCHAR(255) NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_verified BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_users_email ON users (email);
        """
    )
    op.execute(
        """
        CREATE TABLE roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(50) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        """
        CREATE TABLE permissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        """
        CREATE TABLE user_roles (
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            PRIMARY KEY (user_id, role_id)
        );
        CREATE TABLE role_permissions (
            role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
            PRIMARY KEY (role_id, permission_id)
        );
        """
    )
    op.execute(
        """
        CREATE TABLE refresh_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            jti VARCHAR(64) NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            revoked BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id);
        CREATE TABLE password_reset_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash VARCHAR(128) NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_password_reset_token_hash UNIQUE (token_hash)
        );
        CREATE INDEX ix_password_reset_tokens_user_id ON password_reset_tokens (user_id);
        """
    )

    # ---- Case management ---------------------------------------------------
    op.execute(
        """
        CREATE TABLE cases (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            case_number VARCHAR(120),
            court VARCHAR(255),
            jurisdiction VARCHAR(120),
            practice_area VARCHAR(120),
            status VARCHAR(50) NOT NULL DEFAULT 'open',
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_cases_owner_id ON cases (owner_id);

        CREATE TABLE tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
            assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            due_date TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_tasks_case_id ON tasks (case_id);

        CREATE TABLE events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
            event_type VARCHAR(120) NOT NULL,
            title VARCHAR(500) NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_events_case_id ON events (case_id);
        """
    )

    # ---- Documents & knowledge --------------------------------------------
    op.execute(
        """
        CREATE TABLE documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
            case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
            title VARCHAR(500) NOT NULL,
            doc_type VARCHAR(120) NOT NULL,
            jurisdiction VARCHAR(120),
            source_uri TEXT,
            storage_key TEXT,
            content_type VARCHAR(120),
            page_count INTEGER,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_documents_doc_type ON documents (doc_type);
        CREATE INDEX ix_documents_case_id ON documents (case_id);

        CREATE TABLE acts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(500) NOT NULL,
            short_title VARCHAR(255),
            act_number VARCHAR(120),
            year INTEGER,
            jurisdiction VARCHAR(120) NOT NULL DEFAULT 'india',
            category VARCHAR(120),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE sections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            act_id UUID NOT NULL REFERENCES acts(id) ON DELETE CASCADE,
            section_number VARCHAR(60) NOT NULL,
            heading VARCHAR(500),
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_sections_act_id ON sections (act_id);

        CREATE TABLE judgments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title VARCHAR(1000) NOT NULL,
            court VARCHAR(255) NOT NULL,
            citation VARCHAR(255),
            neutral_citation VARCHAR(255),
            judgment_date DATE,
            bench TEXT,
            jurisdiction VARCHAR(120),
            summary TEXT,
            document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_judgments_court ON judgments (court);

        CREATE TABLE legal_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            category VARCHAR(120) NOT NULL,
            jurisdiction VARCHAR(120),
            body TEXT NOT NULL,
            variables JSONB NOT NULL DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )

    # ---- Marketplace & billing --------------------------------------------
    op.execute(
        """
        CREATE TABLE lawyers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            bar_council_id VARCHAR(120),
            full_name VARCHAR(255) NOT NULL,
            practice_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
            jurisdictions JSONB NOT NULL DEFAULT '[]'::jsonb,
            years_experience INTEGER NOT NULL DEFAULT 0,
            languages JSONB NOT NULL DEFAULT '[]'::jsonb,
            rating NUMERIC(3,2) NOT NULL DEFAULT 0,
            rating_count INTEGER NOT NULL DEFAULT 0,
            hourly_rate NUMERIC(10,2),
            bio TEXT,
            is_verified BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_lawyers_user_id ON lawyers (user_id);

        CREATE TABLE consultations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            lawyer_id UUID NOT NULL REFERENCES lawyers(id) ON DELETE CASCADE,
            case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
            scheduled_at TIMESTAMPTZ,
            status VARCHAR(50) NOT NULL DEFAULT 'requested',
            rating INTEGER,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            plan VARCHAR(80) NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'active',
            current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
            current_period_end TIMESTAMPTZ,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_subscriptions_user_id ON subscriptions (user_id);
        """
    )

    # ---- Observability -----------------------------------------------------
    op.execute(
        """
        CREATE TABLE notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            body TEXT,
            channel VARCHAR(50) NOT NULL DEFAULT 'in_app',
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_notifications_user_id ON notifications (user_id);

        CREATE TABLE audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            actor_id UUID,
            action VARCHAR(120) NOT NULL,
            resource_type VARCHAR(120),
            resource_id VARCHAR(120),
            correlation_id VARCHAR(64),
            ip_address VARCHAR(64),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_audit_logs_action ON audit_logs (action);
        CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);
        """
    )


def downgrade() -> None:
    for table in (
        "audit_logs",
        "notifications",
        "subscriptions",
        "consultations",
        "lawyers",
        "legal_templates",
        "judgments",
        "sections",
        "acts",
        "documents",
        "events",
        "tasks",
        "cases",
        "password_reset_tokens",
        "refresh_tokens",
        "role_permissions",
        "user_roles",
        "permissions",
        "roles",
        "users",
    ):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")
