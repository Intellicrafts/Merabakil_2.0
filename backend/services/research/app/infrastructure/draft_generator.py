from __future__ import annotations

import logging
from typing import Any

from legalos_common.clients.llm import ChatMessage, LLMClient

logger = logging.getLogger(__name__)

_DOC_TYPE_LABELS: dict[str, str] = {
    "legal_notice":     "Legal Notice",
    "bail_application": "Bail Application",
    "complaint":        "Complaint",
    "affidavit":        "Affidavit",
    "agreement":        "Agreement",
    "petition":         "Petition",
    "general":          "Legal Document",
}

_SYSTEM_PROMPT = """\
You are an expert Indian legal drafting assistant. When given a request, produce a complete, \
properly formatted legal document ready for use in Indian courts and correspondence.

Rules:
- Output ONLY the document itself — no preamble, no "Here is the draft", no commentary.
- Format with clear markdown headings (##), paragraphs, and formal legal language.
- For any information not provided (names, dates, amounts, addresses), use square-bracket \
  placeholders: [SENDER NAME], [RECIPIENT NAME], [DATE], [AMOUNT], [ADDRESS], [COURT NAME], etc.
- Follow Indian legal conventions (salutations, cause title, prayer clause, verification clause \
  as appropriate for the document type).
- Begin the document with a level-1 markdown heading (# Title) that names the document type \
  and a short subject, e.g. "# Legal Notice — Recovery of Security Deposit".
"""


async def generate_draft(
    query: str,
    document_type: str,
    conversation_context: list[dict[str, str]],
    llm: LLMClient,
) -> dict[str, Any]:
    """Call the LLM to produce a legal draft. Returns {"title", "document_type", "content"}."""
    doc_label = _DOC_TYPE_LABELS.get(document_type, "Legal Document")

    context_block = ""
    if conversation_context:
        turns = "\n".join(
            f"{t['role'].upper()}: {t['content']}" for t in conversation_context[-6:]
        )
        context_block = f"\n\nConversation context (use to infer parties and facts):\n{turns}"

    user_prompt = (
        f"Draft a {doc_label} for the following request:\n{query}{context_block}"
    )

    try:
        raw = await llm.complete(
            [
                ChatMessage(role="system", content=_SYSTEM_PROMPT),
                ChatMessage(role="user", content=user_prompt),
            ],
            temperature=0.3,
        )
    except Exception:
        logger.exception("Draft generation failed")
        raw = f"# {doc_label}\n\n*Could not generate document. Please try again.*"

    title = doc_label
    first_line = raw.strip().splitlines()[0] if raw.strip() else ""
    if first_line.startswith("#"):
        title = first_line.lstrip("#").strip()

    return {
        "title": title,
        "document_type": document_type,
        "content": raw.strip(),
    }
