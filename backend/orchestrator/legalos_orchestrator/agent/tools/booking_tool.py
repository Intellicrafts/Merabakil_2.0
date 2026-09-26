"""Agent tool: book_appointment — books a consultation via the marketplace service."""

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

_NEED_CONFIRMATION = (
    "Not booked. Before booking you must tell the user the lawyer's name, the date and time "
    "slot, and the consultation fee, and get their explicit yes to that booking. Ask them now."
)


def build_book_appointment_tool(marketplace_base_url: str):
    """Factory that closes over the marketplace service URL."""

    @tool(parse_docstring=True)
    async def book_appointment(
        lawyer_id: str,
        date: str,
        time_slot: str,
        matter_summary: str,
        user_confirmed_fee: bool,
        citizen_name: str = "",
        state: Annotated[dict, InjectedState] = None,
        tool_call_id: Annotated[str, InjectedToolCallId] = None,
    ) -> Command:
        """Book a paid consultation with a lawyer returned by get_lawyer.

        Call ONLY after you have told the user the lawyer's name, the date and time slot
        and the consultation fee, and the user has explicitly agreed to that booking.
        Derive matter_summary from the conversation — never make the user repeat it.

        Args:
            lawyer_id: The booking_id UUID from the get_lawyer result, copied exactly.
            date: Consultation date in YYYY-MM-DD format (today's date is in the session context).
            time_slot: "Immediate" if the user asked for right now, otherwise a time like "10:00 AM". Never assume it.
            matter_summary: One-to-two sentence summary of the user's legal matter (min 10 chars).
            user_confirmed_fee: True only if the user explicitly agreed to this lawyer, slot and the fee you stated.
            citizen_name: User's full name if mentioned; leave empty otherwise.
        """
        registry = get_registry(state)
        user_token: str = (state or {}).get("user_token") or ""

        def _reply(content: str) -> Command:
            return Command(update={"messages": [ToolMessage(content=content, tool_call_id=tool_call_id)]})

        if not user_token:
            return _reply("Unable to book: the user is not signed in.")
        if not user_confirmed_fee:
            return _reply(_NEED_CONFIRMATION)

        appt: dict | None = None
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
            logger.warning("book_appointment_http_error status=%s", exc.response.status_code)
            if exc.response.status_code == 402:
                return _reply(
                    "Booking failed: the user's wallet balance is too low for this consultation. "
                    "Tell them to add balance from their wallet and try again."
                )
            return _reply(
                f"Booking failed: {detail or 'the slot may be taken or the lawyer unavailable.'} "
                "Offer another time or lawyer."
            )
        except Exception as exc:
            logger.warning("book_appointment_error error=%s", exc)
            return _reply("The booking service is temporarily unavailable. Ask the user to try again shortly.")

        registry.appointment = appt
        lawyer_name = appt.get("lawyer_name", "the advocate")
        slot = appt.get("time_slot", time_slot)
        appt_date = appt.get("date", date)
        if appt.get("status") == "confirmed":
            content = f"Consultation confirmed with {lawyer_name} on {appt_date} at {slot}."
        else:
            content = (
                f"Consultation request sent to {lawyer_name} for {appt_date} at {slot}. "
                "They will confirm shortly."
            )
        return _reply(content)

    return book_appointment
