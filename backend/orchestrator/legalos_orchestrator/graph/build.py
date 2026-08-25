"""LegalOrchestrator — thin facade over the tool-calling AgentGraph."""

from __future__ import annotations

import json
import logging
import re
from collections.abc import AsyncIterator
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from legalos_common.clients.web_search import search_web_images
from legalos_common.config.settings import LLMSettings
from legalos_common.rag.confidence import score_confidence
from legalos_common.rag.guardrails import OutputGuardrail
from legalos_orchestrator.agent.citation_merger import merge_citations
from legalos_orchestrator.agent.graph import AgentGraph, build_system_message
from legalos_orchestrator.agent.state import LegalAgentState
from legalos_orchestrator.agent.tools.booking_tool import build_book_appointment_tool
from legalos_orchestrator.agent.tools.kb_tool import build_kb_tool
from legalos_orchestrator.agent.tools.lawyer_tool import build_lawyer_tool
from legalos_orchestrator.agent.tools.web_tool import build_web_tool
from legalos_orchestrator.agent.router import QueryRoute
from legalos_orchestrator.conversation import expand_retrieval_query, is_conversational
from legalos_orchestrator.ports import LLMPort, RetrieverPort, SpecialistPort  # LLMPort kept for container compat
from legalos_orchestrator.schemas import (
    Intent,
    JurisdictionResult,
    OrchestratorResult,
    OrchestratorState,
)

logger = logging.getLogger(__name__)

_CONVERSATIONAL_SUGGESTIONS = [
    "What can you help me with in Indian law?",
    "Explain Article 21 of the Constitution",
    "What makes a contract valid in India?",
]

_FALLBACK_SUGGESTIONS = [
    "What are the key statutes that apply here?",
    "What remedies are available under Indian law?",
    "What documents should I gather next?",
]

# Follow-up templates cycled through when KB sources don't provide enough specificity.
_FOLLOW_UP_TEMPLATES = [
    "What remedies and relief are available under Indian law for {topic}?",
    "What are the procedural steps and timeline involved in {topic}?",
    "What are recent Supreme Court judgments on {topic}?",
    "What are the exceptions and limitations related to {topic}?",
    "What key documents and evidence are needed for {topic}?",
]

_QUESTION_PREFIX = re.compile(
    r"^\s*(?:what|how|when|where|who|why|can|could|should|is|are|does|do|will|would)"
    r"(?:\s+(?:is|are|does|can|the|a|an|i|we|my|one))?\s+",
    re.IGNORECASE,
)


def _extract_topic(query: str) -> str:
    """Strip question boilerplate to get the core legal topic."""
    cleaned = _QUESTION_PREFIX.sub("", query).strip().rstrip("?")
    return (cleaned[0].upper() + cleaned[1:]) if cleaned else query.rstrip("?")


def _suggest(query: str, kb_results: list, web_results: list) -> list[str]:
    """Build 3 follow-up suggestions from retrieved sources — no LLM call."""
    if is_conversational(query):
        return _CONVERSATIONAL_SUGGESTIONS

    suggestions: list[str] = []

    # Prefer source-specific suggestions — they give the user a clear next step.
    seen_titles: set[str] = set()
    for src in kb_results[:5]:
        if len(suggestions) >= 2:
            break
        title = getattr(src, "title", None) or getattr(src, "document_id", None)
        if not title or title in seen_titles:
            continue
        seen_titles.add(title)
        section = getattr(src, "section", None)
        if section:
            suggestions.append(f"What does {section} of {title} specifically provide?")
        else:
            suggestions.append(f"What are the key provisions of {title}?")

    # Fill remaining slots with query-derived templates.
    topic = _extract_topic(query)
    for tmpl in _FOLLOW_UP_TEMPLATES:
        if len(suggestions) >= 3:
            break
        candidate = tmpl.format(topic=topic)
        if candidate not in suggestions:
            suggestions.append(candidate)

    return suggestions[:3] or _FALLBACK_SUGGESTIONS

_CONVERSATIONAL_SYSTEM_PROMPT = (
    "You are Mera Vakil, an expert AI legal counsel for India, created by the Bakilat team. "
    "'Mera Vakil' means 'My Advocate' in Hindi. "
    "Respond warmly and briefly to this greeting or casual message — 2-3 sentences max. "
    "You may mention that you can help with Indian law. "
    "Do NOT add a disclaimer — the UI shows a permanent disclaimer."
)


def _sse(event: str, data: Any) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _build_agent_state(state: OrchestratorState) -> LegalAgentState:
    """Convert OrchestratorState into a LegalAgentState ready for the agent graph."""
    from langchain_core.messages import AIMessage

    system_content = build_system_message(state.user_facts or None)
    system_msg = SystemMessage(content=system_content)

    history_msgs = []
    for turn in state.history:
        if turn.role == "user":
            history_msgs.append(HumanMessage(content=turn.content))
        else:
            history_msgs.append(AIMessage(content=turn.content))

    query = expand_retrieval_query(state.query, state.history)
    user_msg = HumanMessage(content=query)

    return LegalAgentState(
        messages=[system_msg, *history_msgs, user_msg],
        session_id=state.session_id,
        user_id=state.user_id,
        search_filters=state.search_filters if not state.search_filters.is_empty() else None,
        user_token=state.user_token,
        top_k=5,
        iterations=0,
        kb_results=[],
        web_results=[],
        lawyer_results=[],
        appointment_result=None,
    )


async def _attach_web_images(query: str) -> list:
    try:
        images = await search_web_images(query, max_results=3)
        return images[:3]
    except Exception as exc:
        logger.warning("web_images_failed error=%s", exc)
        return []


def _build_result(
    state: OrchestratorState,
    answer: str,
    kb_results: list,
    web_sources: list,
    citations: list,
    suggestions: list,
    web_images: list | None = None,
) -> OrchestratorResult:
    return OrchestratorResult(
        query=state.query,
        intent=Intent.LEGAL_RESEARCH,
        jurisdiction=JurisdictionResult(),
        answer=answer,
        sources=kb_results,
        web_sources=web_sources,
        web_images=web_images or [],
        suggestions=suggestions,
        citations=citations,
        confidence=score_confidence(kb_results),
        trace=[],
        specialist_payload={},
    )


class LegalOrchestrator:
    """Facade over the tool-calling AgentGraph."""

    def __init__(
        self,
        *,
        retriever: RetrieverPort,
        llm_settings: LLMSettings,
        llm: LLMPort | None = None,
        contract_review: SpecialistPort | None = None,
        litigation: SpecialistPort | None = None,
    ) -> None:
        kb_tool = build_kb_tool(retriever)
        web_tool = build_web_tool(tavily_api_key=llm_settings.tavily_api_key)
        lawyer_tool = build_lawyer_tool(llm_settings.marketplace_base_url)
        book_appointment_tool = build_book_appointment_tool(llm_settings.marketplace_base_url)
        self._agent_graph = AgentGraph(
            kb_tool=kb_tool,
            web_tool=web_tool,
            lawyer_tool=lawyer_tool,
            book_appointment_tool=book_appointment_tool,
            llm_model=llm_settings.llm_model,
            llm_api_key=llm_settings.llm_api_key,
            llm_base_url=llm_settings.llm_base_url,
        )

    async def _stream_conversational(self, state: OrchestratorState) -> AsyncIterator[str]:
        """Fast path — direct LLM stream with no tools and no LangGraph overhead."""
        from langchain_core.messages import HumanMessage, SystemMessage

        yield _sse("status", {"stage": "thinking", "message": "Responding…"})

        messages = [
            SystemMessage(content=_CONVERSATIONAL_SYSTEM_PROMPT),
            HumanMessage(content=state.query),
        ]
        answer_parts: list[str] = []
        try:
            async for chunk in self._agent_graph.astream_direct(messages):
                if isinstance(chunk.content, str):
                    token = chunk.content
                elif isinstance(chunk.content, list):
                    token = "".join(
                        b.get("text", "") for b in chunk.content
                        if isinstance(b, dict) and b.get("type") == "text"
                    )
                else:
                    token = ""
                if token:
                    answer_parts.append(token)
                    yield _sse("token", {"text": token})
        except Exception as exc:
            logger.error("conversational_stream_error error=%s", exc)
            fallback = "I'm here to help with Indian law. What legal question can I assist you with?"
            answer_parts.append(fallback)
            yield _sse("token", {"text": fallback})

        answer = "".join(answer_parts)
        result = _build_result(state, answer, [], [], [], _CONVERSATIONAL_SUGGESTIONS)
        yield _sse("done", result.model_dump(mode="json"))

    async def run_state_streaming(self, state: OrchestratorState) -> AsyncIterator[str]:
        if state.route == QueryRoute.CONVERSATIONAL:
            async for chunk in self._stream_conversational(state):
                yield chunk
            return

        initial = _build_agent_state(state)

        yield _sse("status", {"stage": "thinking", "message": "Analysing your question…"})

        answer_parts: list[str] = []
        kb_results: list = []
        web_results: list = []
        lawyer_results: list = []
        appointment_result: dict | None = None

        try:
            async for event in self._agent_graph.astream_events(initial):
                kind = event.get("event", "")
                name = event.get("name", "")

                if kind == "on_tool_start":
                    if "knowledge_base" in name:
                        yield _sse("status", {"stage": "research", "message": "Searching legal sources…"})
                    elif "get_lawyer" in name:
                        yield _sse("status", {"stage": "lawyer", "message": "Finding matching lawyers…"})
                    elif "book_appointment" in name:
                        yield _sse("status", {"stage": "booking", "message": "Booking your consultation…"})
                    elif "web" in name:
                        yield _sse("status", {"stage": "web", "message": "Checking recent developments…"})

                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if chunk is not None:
                        token = ""
                        if hasattr(chunk, "content") and isinstance(chunk.content, str):
                            token = chunk.content
                        elif hasattr(chunk, "content") and isinstance(chunk.content, list):
                            for block in chunk.content:
                                if isinstance(block, dict) and block.get("type") == "text":
                                    token += block.get("text", "")
                        if token and not getattr(chunk, "tool_call_chunks", None):
                            answer_parts.append(token)
                            yield _sse("token", {"text": token})

                elif kind == "on_chain_end" and name == "LangGraph":
                    output = event.get("data", {}).get("output", {})
                    kb_results = output.get("kb_results", [])
                    web_results = output.get("web_results", [])
                    lawyer_results = output.get("lawyer_results", [])
                    appointment_result = output.get("appointment_result")

        except Exception as exc:
            logger.error("Agent graph error: %s", exc)
            if not answer_parts:
                fallback = "The AI service is temporarily unavailable. Please retry shortly."
                answer_parts.append(fallback)
                yield _sse("token", {"text": fallback})
                yield _sse("error", {"message": str(exc)})

        raw_answer = "".join(answer_parts)

        citations, cited_web = merge_citations(raw_answer, kb_results, web_results)

        guardrail_result = OutputGuardrail().validate(raw_answer, max_valid_citations=len(citations))
        answer = guardrail_result.answer

        suggestions = _suggest(state.query, kb_results, web_results)
        images = await _attach_web_images(state.query)
        result = _build_result(state, answer, kb_results, cited_web, citations, suggestions, images)
        serialised = result.model_dump(mode="json")
        payload: dict = {}
        if lawyer_results:
            payload["lawyers"] = lawyer_results
        if appointment_result:
            payload["appointment"] = appointment_result
        if payload:
            serialised["specialist_payload"] = payload
        # citations fires first so the UI can render sources before the done event.
        yield _sse("citations", serialised)
        yield _sse("done", serialised)

    async def run_state(self, state: OrchestratorState) -> OrchestratorResult:
        from langchain_core.messages import AIMessage

        initial = _build_agent_state(state)
        final_state = await self._agent_graph.run(initial)

        answer = ""
        for msg in reversed(final_state.get("messages", [])):
            if isinstance(msg, AIMessage) and not msg.tool_calls:
                if isinstance(msg.content, str):
                    answer = msg.content
                elif isinstance(msg.content, list):
                    answer = "".join(
                        b.get("text", "") for b in msg.content
                        if isinstance(b, dict) and b.get("type") == "text"
                    )
                else:
                    answer = ""
                break

        kb_results = final_state.get("kb_results", [])
        web_results = final_state.get("web_results", [])
        lawyer_results_ns = final_state.get("lawyer_results", [])
        appointment_result_ns = final_state.get("appointment_result")
        citations, cited_web = merge_citations(answer, kb_results, web_results)

        guardrail_result = OutputGuardrail().validate(answer, max_valid_citations=len(citations))
        answer = guardrail_result.answer

        suggestions = _suggest(state.query, kb_results, web_results)
        images = await _attach_web_images(state.query)
        result = _build_result(state, answer, kb_results, cited_web, citations, suggestions, images)
        payload_ns: dict = {}
        if lawyer_results_ns:
            payload_ns["lawyers"] = lawyer_results_ns
        if appointment_result_ns:
            payload_ns["appointment"] = appointment_result_ns
        if payload_ns:
            result = result.model_copy(update={"specialist_payload": payload_ns})
        return result

    async def run(
        self, query: str, *, jurisdiction_hint: str | None = None, user_token: str | None = None
    ) -> OrchestratorResult:
        return await self.run_state(
            OrchestratorState(
                query=query, jurisdiction_hint=jurisdiction_hint, user_token=user_token
            )
        )


def build_orchestrator(
    *,
    retriever: RetrieverPort,
    llm_settings: LLMSettings,
    llm: LLMPort,
    contract_review: SpecialistPort | None = None,
    litigation: SpecialistPort | None = None,
) -> LegalOrchestrator:
    return LegalOrchestrator(
        retriever=retriever,
        llm_settings=llm_settings,
        llm=llm,
        contract_review=contract_review,
        litigation=litigation,
    )
