"""Lawyer-marketplace API routes."""

from __future__ import annotations

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.schemas import BatchSummaryResponse, CreateLawyerRequest, LawyerMatchResult, MatchRequest, SummaryResponse
from app.application.summary import LawyerSummaryGenerator
from app.infrastructure.models import Lawyer
from app.infrastructure.repositories import LawyerRepository
from legalos_common.clients.llm import build_llm_client
from legalos_common.config import get_common_settings
from app.infrastructure.db import get_async_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/lawyers", tags=["lawyers"])

settings = get_common_settings()
_llm = build_llm_client(settings.llm)
_generator = LawyerSummaryGenerator(_llm)


def _to_result(lawyer: Lawyer) -> LawyerMatchResult:
    return LawyerMatchResult(
        id=str(lawyer.id),
        full_name=lawyer.full_name,
        bar_council_id=lawyer.bar_council_id,
        practice_areas=list(lawyer.practice_areas or []),
        jurisdictions=list(lawyer.jurisdictions or []),
        years_experience=lawyer.years_experience,
        languages=list(lawyer.languages or []),
        rating=float(lawyer.rating),
        rating_count=lawyer.rating_count,
        hourly_rate=float(lawyer.hourly_rate) if lawyer.hourly_rate is not None else None,
        is_verified=lawyer.is_verified,
        summary=lawyer.summary or "",
    )


@router.post("", response_model=LawyerMatchResult, status_code=status.HTTP_201_CREATED)
async def create_lawyer(
    body: CreateLawyerRequest,
    session: AsyncSession = Depends(get_async_session),
) -> LawyerMatchResult:
    """Create a lawyer profile and immediately generate its LLM summary."""
    repo = LawyerRepository(session)
    lawyer = await repo.create_or_update_for_user(
        user_id=uuid.UUID(body.user_id),
        full_name=body.full_name,
        bar_council_id=body.bar_council_id,
        practice_areas=body.practice_areas,
        jurisdictions=body.jurisdictions,
        years_experience=body.years_experience,
        languages=body.languages,
        hourly_rate=body.hourly_rate,
        bio=body.bio,
        is_verified=body.is_verified,
    )

    try:
        summary = await _generator.generate(lawyer)
        lawyer.summary = summary
    except Exception as exc:
        logger.warning("summary_generation_failed_on_create lawyer_id=%s error=%s", lawyer.id, exc)
        lawyer.summary = ""

    await session.commit()
    await session.refresh(lawyer)
    logger.info("lawyer_created lawyer_id=%s summary_len=%d", lawyer.id, len(lawyer.summary or ""))
    return _to_result(lawyer)


@router.post("/match", response_model=list[LawyerMatchResult])
async def match_lawyers(
    body: MatchRequest,
    session: AsyncSession = Depends(get_async_session),
) -> list[LawyerMatchResult]:
    """Find top matching lawyers for a given legal matter."""
    repo = LawyerRepository(session)
    lawyers = await repo.match(
        practice_areas=body.practice_areas,
        jurisdictions=body.jurisdictions,
        limit=body.limit,
    )
    return [_to_result(l) for l in lawyers]


@router.post("/summaries/batch", response_model=BatchSummaryResponse)
async def batch_generate_summaries(
    session: AsyncSession = Depends(get_async_session),
) -> BatchSummaryResponse:
    """Generate LLM summaries for all lawyers that don't have one yet."""
    repo = LawyerRepository(session)
    lawyers = await repo.get_all_without_summary()
    generated = 0
    for lawyer in lawyers:
        try:
            summary = await _generator.generate(lawyer)
            await repo.update_summary(lawyer.id, summary)
            generated += 1
        except Exception as exc:
            logger.warning("summary_generation_failed lawyer_id=%s error=%s", lawyer.id, exc)
    return BatchSummaryResponse(generated=generated, skipped=len(lawyers) - generated)


@router.post("/{lawyer_id}/summary", response_model=SummaryResponse)
async def generate_summary(
    lawyer_id: uuid.UUID,
    session: AsyncSession = Depends(get_async_session),
) -> SummaryResponse:
    """Generate and store an LLM summary for one lawyer."""
    repo = LawyerRepository(session)
    lawyer = await repo.get_by_id(lawyer_id)
    if not lawyer:
        raise HTTPException(status_code=404, detail="Lawyer not found")

    summary = await _generator.generate(lawyer)
    await repo.update_summary(lawyer_id, summary)
    logger.info("lawyer_summary_generated lawyer_id=%s", lawyer_id)
    return SummaryResponse(lawyer_id=str(lawyer_id), summary=summary)
