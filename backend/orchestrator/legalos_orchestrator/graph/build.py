"""Assemble the LangGraph orchestration flow."""

from __future__ import annotations

from typing import Any

from langgraph.graph import END, START, StateGraph

from legalos_common.rag.schemas import ConfidenceBreakdown
from legalos_orchestrator.agents import (
    ComplianceAgent,
    ContractReviewAgent,
    DraftingAgent,
    EvidenceAgent,
    IntentAgent,
    JurisdictionAgent,
    LawyerMatchingAgent,
    LitigationAgent,
    ReasoningAgent,
    ResearchAgent,
    WebSearchAgent,
)
from legalos_orchestrator.ports import LLMPort, RetrieverPort, SpecialistPort
from legalos_orchestrator.schemas import (
    Intent,
    JurisdictionResult,
    OrchestratorResult,
    OrchestratorState,
)

_INTENT_TO_SPECIALIST: dict[Intent, str] = {
    Intent.CONTRACT_REVIEW: "contract_review",
    Intent.DRAFTING: "drafting",
    Intent.LITIGATION: "litigation",
    Intent.COMPLIANCE: "compliance",
    Intent.LAWYER_MATCHING: "lawyer_matching",
    Intent.EVIDENCE_ANALYSIS: "evidence",
}


def _route_by_intent(state: OrchestratorState) -> str:
    if state.intent is None:
        return END
    return _INTENT_TO_SPECIALIST.get(state.intent.intent, END)


def _state_to_result(state: OrchestratorState) -> OrchestratorResult:
    specialist_payload: dict[str, Any] = {}
    notes = state.metadata.get("specialist_notes", [])
    if notes:
        specialist_payload["notes"] = notes
    if state.metadata.get("specialist_result"):
        specialist_payload["result"] = state.metadata["specialist_result"]

    return OrchestratorResult(
        query=state.query,
        intent=state.intent.intent if state.intent else Intent.LEGAL_RESEARCH,
        jurisdiction=state.jurisdiction or JurisdictionResult(),
        answer=state.answer,
        sources=state.sources,
        web_sources=state.web_sources,
        web_images=state.web_images,
        suggestions=state.suggestions,
        citations=state.citations,
        confidence=state.confidence
        or ConfidenceBreakdown(
            retrieval_strength=0.0, source_agreement=0.0, coverage=0.0, overall=0.0
        ),
        trace=state.trace,
        specialist_payload=specialist_payload,
    )


def _build_graph(
    *,
    retriever: RetrieverPort,
    llm: LLMPort,
    contract_review: SpecialistPort | None = None,
    litigation: SpecialistPort | None = None,
):
    graph = StateGraph(OrchestratorState)

    graph.add_node("intent", IntentAgent())
    graph.add_node("jurisdiction", JurisdictionAgent())
    graph.add_node("research", ResearchAgent(retriever))
    graph.add_node("web_search", WebSearchAgent())
    graph.add_node("reasoning", ReasoningAgent(llm))
    graph.add_node("contract_review", ContractReviewAgent(contract_review))
    graph.add_node("drafting", DraftingAgent())
    graph.add_node("litigation", LitigationAgent(litigation))
    graph.add_node("compliance", ComplianceAgent())
    graph.add_node("lawyer_matching", LawyerMatchingAgent())
    graph.add_node("evidence", EvidenceAgent())

    graph.add_edge(START, "intent")
    graph.add_edge("intent", "jurisdiction")
    graph.add_edge("jurisdiction", "research")
    graph.add_edge("research", "web_search")
    graph.add_edge("web_search", "reasoning")
    graph.add_conditional_edges(
        "reasoning",
        _route_by_intent,
        {
            "contract_review": "contract_review",
            "drafting": "drafting",
            "litigation": "litigation",
            "compliance": "compliance",
            "lawyer_matching": "lawyer_matching",
            "evidence": "evidence",
            END: END,
        },
    )
    for specialist in _INTENT_TO_SPECIALIST.values():
        graph.add_edge(specialist, END)

    return graph.compile()


class LegalOrchestrator:
    """High-level facade over the compiled LangGraph application."""

    def __init__(
        self,
        *,
        retriever: RetrieverPort,
        llm: LLMPort,
        contract_review: SpecialistPort | None = None,
        litigation: SpecialistPort | None = None,
    ) -> None:
        self._app = _build_graph(
            retriever=retriever,
            llm=llm,
            contract_review=contract_review,
            litigation=litigation,
        )

    async def run_state(self, state: OrchestratorState) -> OrchestratorResult:
        raw = await self._app.ainvoke(state)
        final = raw if isinstance(raw, OrchestratorState) else OrchestratorState(**raw)
        return _state_to_result(final)

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
    llm: LLMPort,
    contract_review: SpecialistPort | None = None,
    litigation: SpecialistPort | None = None,
) -> LegalOrchestrator:
    return LegalOrchestrator(
        retriever=retriever,
        llm=llm,
        contract_review=contract_review,
        litigation=litigation,
    )
