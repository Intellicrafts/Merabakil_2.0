"""In-memory Indian-law document templates."""

from __future__ import annotations

TEMPLATES: dict[str, str] = {
    "legal_notice": (
        "LEGAL NOTICE\n\n"
        "To,\n{recipient_name}\n{recipient_address}\n\n"
        "Under instructions from and on behalf of my client {client_name}, "
        "residing at {client_address}, I hereby serve upon you the following "
        "legal notice under the applicable provisions of Indian law, including "
        "the Indian Contract Act, 1872 and the Specific Relief Act, 1963, "
        "as applicable in {jurisdiction}.\n\n"
        "FACTS:\n{facts_summary}\n\n"
        "DEMAND:\nYou are called upon to {demand_action} within {notice_period_days} "
        "days from receipt of this notice, failing which my client shall be "
        "constrained to initiate appropriate civil and/or criminal proceedings "
        "before the competent court or authority at your risk as to costs and "
        "consequences.\n\n"
        "Place: {place}\nDate: {date}\n\n"
        "Advocate for {client_name}\n{advocate_name}\nEnrolment No.: {enrollment_no}"
    ),
    "reply": (
        "REPLY TO LEGAL NOTICE\n\n"
        "To,\n{recipient_name}\n{recipient_address}\n\n"
        "In response to your notice dated {notice_date} concerning {subject_matter}, "
        "I/We, {respondent_name}, state as follows under the laws applicable in "
        "{jurisdiction}, including the Bharatiya Nyaya Sanhita / Indian Penal Code "
        "and the Indian Contract Act, 1872, where relevant:\n\n"
        "1. {paragraph_1}\n"
        "2. {paragraph_2}\n"
        "3. {paragraph_3}\n\n"
        "You are hereby called upon to withdraw your baseless allegations and refrain "
        "from issuing further threats, failing which appropriate legal remedies shall "
        "be availed.\n\n"
        "Place: {place}\nDate: {date}\n\n"
        "{respondent_name}\nThrough: {advocate_name}"
    ),
    "contract_clause": (
        "CLAUSE: {clause_title}\n\n"
        "This clause forms part of the agreement between {party_a} and {party_b} "
        "governed by the laws of India, with {jurisdiction} as the agreed seat "
        "for dispute resolution.\n\n"
        "{clause_body}\n\n"
        "Governing Law: Laws of India, including the Indian Contract Act, 1872, "
        "Arbitration and Conciliation Act, 1996 (if applicable), and sector-specific "
        "regulations as notified.\n\n"
        "Dispute Resolution: {dispute_resolution}\n"
        "Limitation: Parties acknowledge limitation periods under the Limitation Act, 1963."
    ),
}


def get_template(template_type: str) -> str | None:
    return TEMPLATES.get(template_type)
