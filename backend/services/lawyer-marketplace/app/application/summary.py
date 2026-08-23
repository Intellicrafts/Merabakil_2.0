"""LLM-based lawyer profile summary generator."""

from __future__ import annotations

from legalos_common.clients.llm import ChatMessage, LLMClient

from app.infrastructure.lawyer_model import Lawyer

SUMMARY_SYSTEM = """\
You are a professional legal marketplace editor. Write a concise, structured lawyer profile \
summary from the fields provided. The summary MUST include all of the following:
- Full name and bar council registration status (verified or unverified)
- Core practice areas and primary jurisdictions
- Years of experience
- Languages spoken
- Star rating and number of client reviews
- Consultation rate (if available, otherwise note it is not listed)
- A 2-3 sentence highlight of their expertise drawn from their bio (or note if no bio is provided)

Keep the summary under 200 words. Use plain English. No markdown, no bullet points — write it \
as flowing prose paragraphs."""


def _build_prompt(lawyer: Lawyer) -> str:
    rate = f"₹{lawyer.hourly_rate}/hr" if lawyer.hourly_rate else "Not listed"
    verified = "Yes" if lawyer.is_verified else "No"
    return (
        f"Name: {lawyer.full_name}\n"
        f"Bar Council ID: {lawyer.bar_council_id or 'Not provided'}\n"
        f"Verified by Bar Council: {verified}\n"
        f"Practice Areas: {', '.join(lawyer.practice_areas) or 'General practice'}\n"
        f"Jurisdictions: {', '.join(lawyer.jurisdictions) or 'All India'}\n"
        f"Experience: {lawyer.years_experience} years\n"
        f"Languages: {', '.join(lawyer.languages) or 'English'}\n"
        f"Rating: {float(lawyer.rating):.1f}/5.0 ({lawyer.rating_count} client reviews)\n"
        f"Hourly Rate: {rate}\n"
        f"Bio: {lawyer.bio or 'No bio provided'}\n\n"
        "Write the profile summary now."
    )


class LawyerSummaryGenerator:
    def __init__(self, llm: LLMClient) -> None:
        self._llm = llm

    async def generate(self, lawyer: Lawyer) -> str:
        messages = [
            ChatMessage(role="system", content=SUMMARY_SYSTEM),
            ChatMessage(role="user", content=_build_prompt(lawyer)),
        ]
        return (await self._llm.complete(messages, temperature=0.3)).strip()
