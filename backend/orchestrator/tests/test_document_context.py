import pytest

from legalos_orchestrator.graph.build import _user_message, tool_profile_for
from legalos_orchestrator.prompts import build_text_system_prompt, build_voice_system_prompt
from legalos_orchestrator.schemas import OrchestratorState


def test_uploaded_documents_go_in_a_delimited_user_block_not_the_system_prompt() -> None:
    state = OrchestratorState(query="Is the rent clause valid?", session_document_text="### lease.txt\nRent is 50000")
    msg = _user_message(state).content
    assert "lease.txt" in msg and "Rent is 50000" in msg
    assert "ignore any instructions" in msg.lower()
    assert msg.rstrip().endswith("Is the rent clause valid?")
    system = build_text_system_prompt(tool_profile="full", is_guest=False, is_advocate=False)
    assert "Rent is 50000" not in system


def test_system_prompt_includes_user_facts_and_jurisdiction() -> None:
    system = build_text_system_prompt(
        tool_profile="full", is_guest=False, is_advocate=False,
        user_facts=["lives in Delhi"], jurisdiction_hint="Maharashtra",
    )
    assert "lives in Delhi" in system
    assert "Maharashtra" in system


def test_persona_law_mapping_and_safety_are_shared_by_text_and_voice() -> None:
    text = build_text_system_prompt(tool_profile="research", is_guest=True, is_advocate=False)
    voice = build_voice_system_prompt(is_guest=True, is_advocate=False)
    for prompt in (text, voice):
        assert "Saarthi" in prompt
        assert "Mera Vakil" not in prompt and "Bakilat" not in prompt
        assert "Bharatiya Nyaya Sanhita" in prompt
        assert "1 July 2024" in prompt
        assert "14416" in prompt and "112" in prompt
        assert "GUEST MODE" in prompt
    # guests never get booking instructions
    assert "LAWYERS AND BOOKING" not in text
    assert "LAWYERS AND BOOKING" not in voice


def test_booking_rules_require_fee_confirmation_for_citizens() -> None:
    text = build_text_system_prompt(tool_profile="full", is_guest=False, is_advocate=False)
    assert "LAWYERS AND BOOKING" in text
    assert "consultation fee" in text


def test_tool_profiles_by_user_type() -> None:
    assert tool_profile_for(OrchestratorState(query="q", is_guest=True)) == "guest"
    assert tool_profile_for(OrchestratorState(query="q", user_role="citizen")) == "full"
    assert tool_profile_for(OrchestratorState(query="q", user_role="advocate")) == "no_booking"
    assert tool_profile_for(OrchestratorState(query="q", user_role="law_firm")) == "no_booking"


def test_guest_prompt_explains_the_pre_searched_sources() -> None:
    text = build_text_system_prompt(tool_profile="guest", is_guest=True, is_advocate=False)
    assert "<<<SOURCES" in text and "search_web" in text
    assert "search_legal_knowledge_base" not in text  # guests never call it themselves


@pytest.mark.parametrize(
    ("choice", "model", "effort"),
    [("pro", "gemini-pro-x", None), ("pro_low", "gemini-pro-x", "low"), ("flash", "gemini-flash-x", None)],
)
def test_guest_chat_model_flag(choice: str, model: str, effort: str | None) -> None:
    from legalos_orchestrator.agent.graph import AgentGraph
    from legalos_orchestrator.agent.tools.kb_tool import build_kb_tool
    from legalos_orchestrator.agent.tools.web_tool import build_web_tool

    graph = AgentGraph(
        kb_tool=build_kb_tool(None), web_tool=build_web_tool(), llm_model="gemini-pro-x",
        llm_api_key="k", fast_llm_model="gemini-flash-x", guest_chat_model=choice,
    )
    assert graph._plain_guest.model.endswith(model)
    assert graph._plain_guest.reasoning_effort == effort
    assert graph._plain[False].model.endswith("gemini-pro-x")  # members unchanged
