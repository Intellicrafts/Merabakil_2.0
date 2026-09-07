"""Case brief extraction from Saarthi session history."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.infrastructure.container import get_container
from app.infrastructure.llm_json import complete_json
from legalos_common.security.rbac import CurrentUser, Permission, require_permissions

logger = logging.getLogger(__name__)
extraction_router = APIRouter(prefix="/api/v1/research", tags=["case-extraction"])

_settings = get_settings()

_SYSTEM_PROMPT = """You are a legal case analyst. Analyse the conversation history between a user and an AI legal assistant and extract a structured case brief.

Return ONLY valid JSON with this exact schema — no markdown, no explanation:
{
  "case_title": "<concise 3-10 word title, max 80 chars>",
  "problem_summary": "<2-3 sentence summary of the legal problem>",
  "key_facts": ["<fact1>", "<fact2>", ...],
  "parties": {
    "client": {"name": "<name or 'User'>" , "role": "<Petitioner/Plaintiff/Accused/etc>"},
    "opponent": {"name": "<name or 'Unknown'>", "type": "<Individual/Organization/Government/Unknown>"}
  },
  "jurisdiction": "<jurisdiction or null>",
  "practice_area": "<e.g. Criminal Law, Property Law, Family Law, Labour Law, Contract Law, or null>",
  "legal_issues": ["<issue1>", "<issue2>", ...],
  "recommended_actions": ["<action1>", "<action2>", ...],
  "urgency": "<low|medium|high>",
  "confidence": <0.0-1.0>
}

Rules:
- key_facts: 3-8 items maximum
- legal_issues: 1-5 items
- recommended_actions: 2-6 items
- urgency=high if there are deadlines, criminal charges, eviction, custody risks, or imminent harm
- confidence reflects how much legal information the conversation contains (low if vague)
- Use null for jurisdiction/practice_area if unclear from conversation
"""


class CaseBriefExtraction(BaseModel):
    case_title: str = Field(max_length=80)
    problem_summary: str
    key_facts: list[str]
    parties: dict
    jurisdiction: str | None
    practice_area: str | None
    legal_issues: list[str]
    recommended_actions: list[str]
    urgency: Literal["low", "medium", "high"]
    confidence: float = Field(ge=0.0, le=1.0)


@extraction_router.post(
    "/sessions/{session_id}/extract-case",
    response_model=CaseBriefExtraction,
    summary="Extract a structured case brief from a Saarthi session",
)
async def extract_case_brief(
    session_id: str,
    user: CurrentUser = Depends(require_permissions(Permission.RESEARCH_READ.value)),
) -> CaseBriefExtraction:
    container = get_container()

    turns = await container.memory_manager._session.get_history(session_id)
    # Filter to real user/assistant turns (skip summary placeholders)
    real_turns = [t for t in turns if t.role in ("user", "assistant")]

    if len(real_turns) < 3:
        raise HTTPException(
            status_code=400,
            detail="At least 3 conversation turns are required to extract a case brief.",
        )

    # Build conversation transcript for the LLM
    transcript_parts = []
    for turn in real_turns:
        prefix = "User" if turn.role == "user" else "Saarthi"
        transcript_parts.append(f"{prefix}: {turn.content}")
    transcript = "\n\n".join(transcript_parts)

    raw = await complete_json(
        container.llm,
        system=_SYSTEM_PROMPT,
        user=f"Conversation:\n\n{transcript}",
        fallback={},
        temperature=0.1,
    )

    if not raw:
        raise HTTPException(
            status_code=422,
            detail="Could not extract a structured case brief from this conversation.",
        )

    try:
        extraction = CaseBriefExtraction(
            case_title=raw.get("case_title", "Legal Matter")[:80],
            problem_summary=raw.get("problem_summary", ""),
            key_facts=raw.get("key_facts", []),
            parties=raw.get("parties", {}),
            jurisdiction=raw.get("jurisdiction"),
            practice_area=raw.get("practice_area"),
            legal_issues=raw.get("legal_issues", []),
            recommended_actions=raw.get("recommended_actions", []),
            urgency=raw.get("urgency", "medium"),
            confidence=float(raw.get("confidence", 0.5)),
        )
    except Exception as exc:
        logger.warning("case_extraction_validation_failed session=%s error=%s", session_id, exc)
        raise HTTPException(
            status_code=422,
            detail="Extraction output did not match expected schema.",
        ) from exc

    return extraction
