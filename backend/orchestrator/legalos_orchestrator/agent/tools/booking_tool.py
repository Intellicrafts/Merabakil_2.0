"""Agent tool: book_appointment — books a consultation via the marketplace service."""

from __future__ import annotations

import logging
from typing import Annotated

import httpx
from langchain_core.messages import ToolMessage
from langchain_core.tools import InjectedToolCallId, tool
from langgraph.types import Command

try:
    from langgraph.prebuilt import InjectedState
except ImportError:
    from typing import Any as InjectedState  # type: ignore[assignment]

logger = logging.getLogger(__name__)


def build_book_appointment_tool(marketplace_base_url: str):
    """Factory that closes over the marketplace service URL."""

    @tool(parse_docstring=True)
    async def book_appointment(
        lawyer_id: str,
        date: str,
        time_slot: str,
        matter_summary: str,
        citizen_name: str = "",
        state: Annotated[dict, InjectedState] = None,
        tool_call_id: Annotated[str, InjectedToolCallId] = None,
    ) -> Command:
        """Book a consultation appointment with a verified lawyer on the platform.

        Call this tool ONLY after get_lawyer has returned results and the user has expressed
        intent to book (e.g., "book it", "yes please", "schedule a consultation").
        Use the lawyer's id from the get_lawyer result. Derive matter_summary from the
        conversation — never ask the user to repeat what they already told you.
        Default time_slot to "Immediate" unless the user specifies a time.

        Args:
            lawyer_id: UUID of the lawyer from the get_lawyer result.
            date: Consultation date in YYYY-MM-DD format. Use today's date unless the user
                  specifies otherwise (today is provided in the system prompt context).
            time_slot: "Immediate" for right now, or a specific time like "10:00 AM".
            matter_summary: One-to-two sentence summary of the user's legal matter (min 10 chars).
            citizen_name: User's full name if mentioned; leave empty otherwise.
        """
        user_token: str = (state or {}).get("user_token") or ""

        if not user_token:
            content = "Unable to book: no authentication token available."
            return Command(
                update={
                    "messages": [ToolMessage(content=content, tool_call_id=tool_call_id)],
                }
            )

        appt: dict | None = None
        content = ""
        try:
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.post(
                    f"{marketplace_base_url}/api/v1/appointments",
                    json={
                        "lawyer_id": lawyer_id,
                        "date": date,
                        "time_slot": time_slot,
                        "matter_summary": matter_summary,
                        "source": "ai_match",
                        "citizen_name": citizen_name or "",
                    },
                    headers={"Authorization": f"Bearer {user_token}"},
                )
                resp.raise_for_status()
                appt = resp.json()
        except httpx.HTTPStatusError as exc:
            detail = ""
            try:
                detail = exc.response.json().get("detail", "")
            except Exception:
                pass
            logger.warning("book_appointment http_error=%s detail=%s", exc, detail)
            content = f"Booking failed: {detail or 'the slot may already be taken or the lawyer unavailable. Please try another time or lawyer.'}"
        except Exception as exc:
            logger.warning("book_appointment error=%s", exc)
            content = "The booking service is temporarily unavailable. Please ask the user to try again shortly."

        if appt:
            lawyer_name = appt.get("lawyer_name", "the advocate")
            slot = appt.get("time_slot", time_slot)
            appt_date = appt.get("date", date)
            status = appt.get("status", "requested")
            if status == "confirmed":
                content = (
                    f"✅ Consultation confirmed with **{lawyer_name}** on {appt_date} at {slot}. "
                    "The user will receive a confirmation notification."
                )
            else:
                content = (
                    f"✅ Consultation request sent to **{lawyer_name}** for {appt_date} at {slot}. "
                    "They will confirm the appointment shortly."
                )

        return Command(
            update={
                "appointment_result": appt,
                "messages": [ToolMessage(content=content, tool_call_id=tool_call_id)],
            }
        )

    return book_appointment
