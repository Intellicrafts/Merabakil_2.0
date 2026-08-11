"""Legal reasoning agent: grounds an answer in retrieved sources with citations."""

from __future__ import annotations

from collections.abc import AsyncIterator

from legalos_common.clients.llm import ChatMessage
from legalos_common.rag.confidence import score_confidence
from legalos_common.rag.context import assemble_context
from legalos_orchestrator.agents.base import Agent
from legalos_orchestrator.conversation import build_chat_messages, is_conversational
from legalos_orchestrator.ports import LLMPort
from legalos_orchestrator.schemas import OrchestratorState

_GROUNDED_SYSTEM_PROMPT = (
    "You are Mera Vakil, a meticulous AI legal counsel for India. Answer primarily using "
    "the numbered CORPUS CONTEXT below and cite supporting sources inline using their bracketed "
    "markers (e.g. [1], [2]). Do not fabricate statutes, sections or citations that are not "
    "in the context. Be precise about jurisdiction.\n\n"
    "FORMAT (IMPORTANT):\n"
    "- Use professional markdown: a clear ## Summary, ## Key Points (bullets), and ## Practical Note.\n"
    "- Keep paragraphs short. Use bold for key legal terms.\n"
    "- Close with a brief note that this is informational and not a substitute for advice "
    "from a licensed advocate.\n\n"
    "CONVERSATION MEMORY:\n"
    "Use prior chat turns to interpret follow-up questions. Answer the user's latest message.\n\n"
    "CORPUS CONTEXT:\n{context}"
)

_WEB_SUPPLEMENT_PROMPT = (
    "You are Mera Vakil, a meticulous AI legal counsel for India. The platform's verified "
    "knowledge base had limited coverage for this question, so you also received WEB CONTEXT "
    "from public sources. Combine both carefully: prefer CORPUS CONTEXT when available, and "
    "use WEB CONTEXT to fill gaps. Do not invent citations.\n\n"
    "FORMAT (IMPORTANT):\n"
    "- Use professional markdown: ## Summary, ## Key Points, ## Sources & Further Reading.\n"
    "- Mention when information comes from web sources (not the verified corpus).\n"
    "- Keep the answer concise, accurate, and well structured.\n\n"
    "CONVERSATION MEMORY:\n"
    "Use prior chat turns to interpret follow-up questions.\n\n"
    "CORPUS CONTEXT:\n{corpus}\n\nWEB CONTEXT:\n{web}"
)

_GENERAL_SYSTEM_PROMPT = (
    "You are Mera Vakil, a warm, intelligent and highly professional AI legal assistant for "
    "India, created by the Bakilat team as part of an AI Legal Operating System. 'Mera Vakil' "
    "means 'My Advocate' in Hindi.\n\n"
    "PERSONALITY:\n"
    "- Friendly, confident, concise and respectful. You speak like a knowledgeable Indian "
    "legal professional, and you can use a little Hindi/English ('Namaste') naturally.\n"
    "- You may answer light conversational messages and questions about yourself.\n\n"
    "SCOPE:\n"
    "- You ONLY provide substantive answers about legal matters.\n"
    "- Politely decline clearly non-legal requests.\n\n"
    "FORMAT:\n"
    "- Use clean markdown with short paragraphs and bullets where helpful.\n\n"
    "CONVERSATION MEMORY:\n"
    "- Use prior turns to interpret follow-ups and stay consistent."
)

_SUGGESTIONS_PROMPT = (
    "You suggest follow-up questions for a legal chat. Return exactly 3 short, relevant "
    "follow-up questions the user might ask next. One question per line. No numbering, "
    "no bullets, no extra text. Questions must relate to the current topic and Indian law."
)


def _format_web_context(state: OrchestratorState) -> str:
    lines: list[str] = []
    for idx, item in enumerate(state.web_sources, start=1):
        lines.append(f"[W{idx}] {item.title}\nURL: {item.url}\n{item.snippet}")
    for idx, image in enumerate(state.web_images, start=1):
        lines.append(
            f"[Image {idx}] {image.title}\nCaption: {image.caption}\nSource: {image.source_url}"
        )
    return "\n\n".join(lines) if lines else "No web context available."


class ReasoningAgent(Agent):
    name = "reasoning_agent"

    def __init__(self, llm: LLMPort) -> None:
        self._llm = llm

    async def _build_messages(self, state: OrchestratorState) -> tuple[list[ChatMessage], float]:
        if is_conversational(state.query):
            return build_chat_messages(_GENERAL_SYSTEM_PROMPT, state.history, state.query), 0.5

        context, _ = assemble_context(state.sources)
        web_context = _format_web_context(state)

        if state.web_sources or state.web_images:
            prompt = _WEB_SUPPLEMENT_PROMPT.format(
                corpus=context or "No corpus context available.",
                web=web_context,
            )
            return build_chat_messages(prompt, state.history, state.query), 0.2
        if state.sources:
            return (
                build_chat_messages(
                    _GROUNDED_SYSTEM_PROMPT.format(context=context),
                    state.history,
                    state.query,
                ),
                0.1,
            )
        return build_chat_messages(_GENERAL_SYSTEM_PROMPT, state.history, state.query), 0.4

    async def stream_answer(self, state: OrchestratorState) -> AsyncIterator[str]:
        if is_conversational(state.query):
            messages, temperature = await self._build_messages(state)
            async for token in self._llm.stream_complete(messages, temperature=temperature):
                yield token
            return

        messages, temperature = await self._build_messages(state)
        async for token in self._llm.stream_complete(messages, temperature=temperature):
            yield token

    async def _generate_suggestions(self, state: OrchestratorState, answer: str) -> list[str]:
        if is_conversational(state.query):
            return [
                "What can you help me with in Indian law?",
                "Explain Article 21 of the Constitution",
                "What makes a contract valid in India?",
            ]

        try:
            raw = await self._llm.complete(
                [
                    ChatMessage(role="system", content=_SUGGESTIONS_PROMPT),
                    ChatMessage(
                        role="user",
                        content=f"User question: {state.query}\n\nAssistant answer:\n{answer[:1200]}",
                    ),
                ],
                temperature=0.5,
            )
        except Exception:
            return [
                "What are the key statutes that apply here?",
                "What remedies are available under Indian law?",
                "What documents should I gather next?",
            ]

        suggestions = [line.strip("•- ").strip() for line in raw.splitlines() if line.strip()]
        return [s for s in suggestions if len(s) > 8][:3]

    async def run(self, state: OrchestratorState) -> dict:
        if is_conversational(state.query):
            messages, temperature = await self._build_messages(state)
            answer = await self._llm.complete(messages, temperature=temperature)
            return {
                "answer": answer,
                "sources": [],
                "citations": [],
                "web_sources": [],
                "web_images": [],
                "confidence": score_confidence([]),
                "suggestions": await self._generate_suggestions(state, answer),
            }

        context, citations = assemble_context(state.sources)
        confidence = score_confidence(state.sources)
        messages, temperature = await self._build_messages(state)
        answer = await self._llm.complete(messages, temperature=temperature)

        return {
            "answer": answer,
            "citations": citations,
            "confidence": confidence,
            "suggestions": await self._generate_suggestions(state, answer),
        }
