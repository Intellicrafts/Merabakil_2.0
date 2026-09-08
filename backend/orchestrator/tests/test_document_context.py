from legalos_orchestrator.agent.graph import build_system_message


def test_system_message_includes_uploaded_docs() -> None:
    msg = build_system_message(None, "### lease.txt\nRent is 50000")
    assert "lease.txt" in msg
    assert "Rent is 50000" in msg
    assert "USER-UPLOADED" in msg or "attached" in msg.lower()


def test_system_message_without_docs_omits_excerpt() -> None:
    msg = build_system_message(["lives in Delhi"], None)
    assert "lives in Delhi" in msg
    assert "lease.txt" not in msg
