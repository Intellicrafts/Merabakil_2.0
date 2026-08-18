"""LangGraph tool-calling orchestrator for the AI Legal OS."""

# Schemas and ports are lightweight — safe to import anywhere
from legalos_orchestrator.ports import LLMPort, RetrieverPort
from legalos_orchestrator.schemas import OrchestratorResult, OrchestratorState


def build_orchestrator(**kwargs):
    """Lazy wrapper — defers langchain_openai import until first call."""
    from legalos_orchestrator.graph.build import build_orchestrator as _build
    return _build(**kwargs)


__all__ = [
    "LLMPort",
    "OrchestratorResult",
    "OrchestratorState",
    "RetrieverPort",
    "build_orchestrator",
]
