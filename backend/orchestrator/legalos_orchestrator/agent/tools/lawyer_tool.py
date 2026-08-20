"""Agent tool: get_lawyer — finds top matching lawyers from the marketplace service."""

from __future__ import annotations

import logging
from typing import Annotated

import httpx
from langchain_core.messages import ToolMessage
from langchain_core.tools import tool
from langgraph.prebuilt import InjectedToolCallId
from langgraph.types import Command

try:
    from langgraph.prebuilt import InjectedState
except ImportError:
    from typing import Any as InjectedState  # type: ignore[assignment]

logger = logging.getLogger(__name__)


def _format_lawyers(lawyers: list[dict]) -> str:
    if not lawyers:
        return "No matching lawyers found on the platform."
    lines = ["**Recommended Lawyers:**\n"]
    for i, lawyer in enumerate(lawyers, 1):
        lines.append(f"[LAWYER-{i}] {lawyer['full_name']}")
        if lawyer.get("summary"):
            lines.append(lawyer["summary"])
        lines.append("")
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
        """Find the top 3 verified lawyers matching the user's legal matter.

        Call this tool ONLY when the user's situation clearly requires professional legal
        representation — e.g. criminal charges, court proceedings, property disputes,
        corporate litigation, family law (divorce/custody), or when the user explicitly
        asks to find or recommend a lawyer.
        Do NOT call for general informational queries that the knowledge base can answer.

        Args:
            practice_areas: Relevant practice areas extracted from the conversation
                            (e.g. ["criminal law", "bail", "FIR"]).
            jurisdictions: Relevant court or state jurisdictions
                           (e.g. ["Delhi High Court", "Rajasthan"]).
        """
        current: list = (state or {}).get("lawyer_results", [])
        lawyers: list[dict] = []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{marketplace_base_url}/api/v1/lawyers/match",
                    json={
                        "practice_areas": practice_areas,
                        "jurisdictions": jurisdictions,
                        "limit": 3,
                    },
                )
                resp.raise_for_status()
                lawyers = resp.json()
        except Exception as exc:
            logger.warning("get_lawyer_failed error=%s", exc)

        content = _format_lawyers(lawyers)
        return Command(
            update={
                "lawyer_results": current + lawyers,
                "messages": [ToolMessage(content=content, tool_call_id=tool_call_id)],
            }
        )

    return get_lawyer
