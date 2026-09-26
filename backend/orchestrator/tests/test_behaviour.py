"""Behavioural tests: citation numbering, guardrails, safety, and the streaming contract."""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest

from legalos_common.rag.guardrails import OutputGuardrail, strip_citation_markers
from legalos_common.rag.schemas import RetrievedSource, WebSearchResult
from legalos_orchestrator.agent.registry import SourceRegistry
from legalos_orchestrator.agent.router import QueryRoute
from legalos_orchestrator.graph.build import LegalOrchestrator
from legalos_orchestrator.safety import helpline_preface, is_emergency
from legalos_orchestrator.schemas import ConversationMessage, OrchestratorState


def _src(i: int) -> RetrievedSource:
    return RetrievedSource(chunk_id=f"c{i}", document_id=f"d{i}", title=f"Act {i}", content=f"text {i}", score=0.5)


# ── Citation registry ────────────────────────────────────────────────────────


def test_registry_numbers_are_stable_across_calls_and_deduplicated() -> None:
    reg = SourceRegistry()
    first = [reg.add_kb(_src(i)) for i in (1, 2)]
    second = [reg.add_kb(_src(i)) for i in (2, 3)]  # second search repeats c2
    assert first == [1, 2]
    assert second == [2, 3]
    assert [s.chunk_id for s in reg.kb] == ["c1", "c2", "c3"]


def test_registry_web_numbers_follow_insertion_order() -> None:
    reg = SourceRegistry()
    a = WebSearchResult(title="A", url="https://a")
    b = WebSearchResult(title="B", url="https://b")
    assert [reg.add_web(a), reg.add_web(b), reg.add_web(a)] == [1, 2, 1]
    assert reg.web == [a, b]


# ── Output guardrail ─────────────────────────────────────────────────────────


def test_guardrail_keeps_valid_markers_and_drops_unknown_ones() -> None:
    out = OutputGuardrail().validate(
        "Limitation is 3 years [KB-1]. Recent change [WEB-1]. Bogus [KB-7].",
        kb_count=2, web_count=1, used_tools=True,
    )
    assert "[KB-1]" in out.answer and "[WEB-1]" in out.answer
    assert "[KB-7]" not in out.answer
    assert "Note:" not in out.answer


def test_guardrail_does_not_touch_law_report_citations() -> None:
    text = "See Maneka Gandhi v. Union of India, [1978] 2 SCR 621 [KB-1]."
    out = OutputGuardrail().validate(text, kb_count=1, used_tools=True)
    assert "[1978] 2 SCR 621" in out.answer


def test_guardrail_adds_note_only_when_retrieved_sources_went_uncited() -> None:
    long_answer = "word " * 150
    assert "Note:" not in OutputGuardrail().validate(long_answer).answer
    assert "Note:" in OutputGuardrail().validate(long_answer, kb_count=3, used_tools=True).answer


def test_strip_citation_markers() -> None:
    assert strip_citation_markers("Rule [KB-1] and [WEB-2].") == "Rule and."


# ── Emergency detection ──────────────────────────────────────────────────────


@pytest.mark.parametrize("text", [
    "My husband beats me every night, what can I do?",
    "I want to die, nothing is working",
    "he is threatening to kill me over the property",
    "mera pati roz maarta hai",
    "मेरा पति मुझे मारता है",
    "someone is abusing my child at home",
])
def test_emergency_detected(text: str) -> None:
    assert is_emergency(text)


@pytest.mark.parametrize("text", [
    "What is the punishment for murder under BNS?",
    "How do I file an FIR for theft?",
    "What is the Domestic Violence Act?",
    "Can my landlord evict me without notice?",
])
def test_routine_questions_are_not_emergencies(text: str) -> None:
    assert not is_emergency(text)


def test_any_mention_of_suicide_shows_helplines_by_design() -> None:
    # Over-triggering here is deliberate: a helpline line costs little, a miss costs a lot.
    assert is_emergency("Is abetment of suicide a cognizable offence?")


def test_helpline_preface_language() -> None:
    assert "112" in helpline_preface("help me") and "Emergency" in helpline_preface("help me")
    assert "आपातकाल" in helpline_preface("मुझे मदद चाहिए")


# ── Streaming contract (fake agent graph) ────────────────────────────────────


class _FakeGraph:
    def __init__(self, *, tokens=("Answer",), fail_primary=False, fail_fast=False):
        self.tokens = tokens
        self.fail_primary = fail_primary
        self.fail_fast = fail_fast
        self.calls: list[bool] = []
        self.direct_calls = 0

    async def astream_events(self, initial):
        use_fast = bool(initial.get("use_fast"))
        self.calls.append(use_fast)
        if (use_fast and self.fail_fast) or (not use_fast and self.fail_primary):
            raise RuntimeError("provider down")
        for t in self.tokens:
            yield {"event": "on_chat_model_stream", "name": "m", "data": {"chunk": SimpleNamespace(content=t, tool_call_chunks=None)}}

    async def astream_direct(self, messages):
        self.direct_calls += 1
        yield SimpleNamespace(content="Hello!")

    async def complete_fast(self, messages):
        return "Q1?\nQ2?\nQ3?"


def _orchestrator(graph: _FakeGraph) -> LegalOrchestrator:
    orch = object.__new__(LegalOrchestrator)
    orch._agent_graph = graph
    return orch


def _events(orch: LegalOrchestrator, state: OrchestratorState) -> list[tuple[str, dict]]:
    async def run():
        out = []
        async for chunk in orch.run_state_streaming(state):
            head, _, data = chunk.partition("\ndata: ")
            out.append((head.removeprefix("event: "), json.loads(data)))
        return out
    return asyncio.run(run())


def test_yes_after_history_goes_to_the_agent_not_small_talk() -> None:
    graph = _FakeGraph()
    state = OrchestratorState(
        query="yes",
        route=QueryRoute.CONVERSATIONAL,
        history=[
            ConversationMessage(role="user", content="I need a lawyer for bail"),
            ConversationMessage(role="assistant", content="Shall I book Adv. X for ₹500?"),
        ],
    )
    events = _events(_orchestrator(graph), state)
    assert graph.direct_calls == 0 and graph.calls == [False]
    assert events[-1][0] == "done" and events[-1][1]["mode"] == "agent"


def test_fresh_greeting_uses_fast_path_and_is_marked_conversational() -> None:
    graph = _FakeGraph()
    events = _events(_orchestrator(graph), OrchestratorState(query="hi", route=QueryRoute.CONVERSATIONAL))
    assert graph.direct_calls == 1
    assert events[-1][0] == "done" and events[-1][1]["mode"] == "conversational"


def test_primary_failure_before_tokens_falls_back_to_fast_model() -> None:
    graph = _FakeGraph(fail_primary=True)
    events = _events(_orchestrator(graph), OrchestratorState(query="What is Section 138 NI Act?"))
    assert graph.calls == [False, True]
    assert events[-1][0] == "done"


def test_total_failure_ends_with_error_and_no_done() -> None:
    graph = _FakeGraph(fail_primary=True, fail_fast=True)
    events = _events(_orchestrator(graph), OrchestratorState(query="What is Section 138 NI Act?"))
    names = [e[0] for e in events]
    assert names[-1] == "error" and "done" not in names
    assert events[-1][1]["code"] == "ai_unavailable"
    assert "provider down" not in json.dumps(events)  # internals never reach the client


def test_emergency_message_leads_with_helplines() -> None:
    graph = _FakeGraph(tokens=("You can seek a protection order.",))
    events = _events(_orchestrator(graph), OrchestratorState(query="My husband beats me", route=QueryRoute.LEGAL))
    first_token = next(d["text"] for e, d in events if e == "token")
    assert "112" in first_token
    done = events[-1][1]
    assert done["answer"].startswith(first_token)
