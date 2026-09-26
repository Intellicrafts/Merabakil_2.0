"""Agent tool: get_lawyer — finds top matching verified lawyers from the marketplace."""

from __future__ import annotations

import logging
from typing import Annotated

import httpx
from langchain_core.messages import ToolMessage
from langchain_core.tools import InjectedToolCallId, tool
from langgraph.prebuilt import InjectedState
from langgraph.types import Command

from legalos_orchestrator.agent.registry import get_registry

logger = logging.getLogger(__name__)


def format_fee(lawyer: dict) -> str:
    rate = lawyer.get("hourly_rate")
    if not rate:
        return "fee not listed"
    return f"₹{float(rate):,.0f} per consultation (first consultation on MeraBakil is free)"


def lawyer_line(i: int, lawyer: dict) -> str:
    """One line per lawyer — also reused to remind the model in later turns."""
    areas = ", ".join((lawyer.get("practice_areas") or [])[:3])
    city = lawyer.get("city") or ""
    exp = lawyer.get("years_experience") or 0
    return (
        f"[LAWYER-{i}] {lawyer.get('full_name', '')} (booking_id: {lawyer.get('id', '')}) — "
        f"{areas}{' — ' + city if city else ''} — {exp} yrs — fee: {format_fee(lawyer)}"
    )


def _format_lawyers(lawyers: list[dict]) -> str:
    if not lawyers:
        return (
            "No matching verified lawyers found on the platform. Tell the user our directory has "
            "no match right now and suggest the State Bar Council or NALSA free legal aid (15100)."
        )
    lines = ["Verified lawyers matching this matter:"]
    for i, lawyer in enumerate(lawyers, 1):
        lines.append(lawyer_line(i, lawyer))
        summary = (lawyer.get("summary") or "").strip()
        if summary:
            lines.append(f"  {summary[:300]}")
    lines.append(
        "Before booking: state the lawyer, date/time and fee, and get the user's explicit yes."
    )
    return "\n".join(lines)


def build_lawyer_tool(marketplace_base_url: str):
    """Factory that closes over the marketplace service URL."""

    @tool(parse_docstring=True)
    async def get_lawyer(
        practice_areas: list[str],
        jurisdictions: list[str],
        state: Annotated[dict, InjectedState] = None,
        tool_call_id: Annotated[str, InjectedToolCallId] = None,
    ) -> Command:
        """Find up to 3 verified lawyers on MeraBakil matching the user's legal matter.

        Call ONLY when the matter clearly needs professional representation (arrest, FIR,
        bail, court notice, property/family/employment/consumer dispute likely to go to
        court) or when the user asks for a lawyer. Not for general information questions.

        Args:
            practice_areas: Relevant practice areas from the conversation (e.g. ["criminal law", "bail"]).
            jurisdictions: Relevant states, cities or courts (e.g. ["Delhi High Court", "Rajasthan"]).
        """
        registry = get_registry(state)
        lawyers: list[dict] = []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{marketplace_base_url}/api/v1/lawyers/match",
                    json={"practice_areas": practice_areas, "jurisdictions": jurisdictions, "limit": 3},
                )
                resp.raise_for_status()
                lawyers = [l for l in resp.json() if l.get("is_verified")]
        except Exception as exc:
            logger.warning("get_lawyer_failed error=%s", exc)

        registry.add_lawyers(lawyers)
        return Command(
            update={"messages": [ToolMessage(content=_format_lawyers(lawyers), tool_call_id=tool_call_id)]}
        )

    return get_lawyer
