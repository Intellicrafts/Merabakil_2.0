"""Tests for post-hearing courtroom action planner."""

from __future__ import annotations

from app.api.schemas import CourtroomActionsRequest, CourtroomAgendaItemIn
from app.application.courtroom_actions import (
    _to_response,
    fallback_action_plan,
)


def test_fallback_action_plan_commercial_has_prioritized_actions() -> None:
    body = CourtroomActionsRequest(
        matter_title="SLA breach — Acme vs Beta",
        matter_type="Commercial",
        petitioner_name="Adv. A",
        respondent_name="Adv. B",
        disposition="Petition partly allowed",
        weaknesses_exposed=["Weak causation proof"],
        agenda=[
            CourtroomAgendaItemIn(id="pt-1", label="Breach chronology", status="contested"),
        ],
    )
    data = fallback_action_plan(body)
    assert data["headline"]
    assert len(data["actions"]) >= 4
    assert data["actions"][0]["priority"] == "critical"
    assert data["documentsToGather"]
    assert data["disclaimer"]

    response = _to_response(data, data)
    assert response.actions[0].priority == "critical"
    assert response.limitation_flags
    assert response.research_angles


def test_fallback_criminal_adds_crpc_action() -> None:
    body = CourtroomActionsRequest(
        matter_title="Bail matter",
        matter_type="Criminal",
        petitioner_name="Adv. A",
        respondent_name="Adv. B",
    )
    data = fallback_action_plan(body)
    titles = " ".join(a["title"] for a in data["actions"]).lower()
    assert "crpc" in titles or "bail" in titles


def test_to_response_sorts_and_caps_actions() -> None:
    fallback = fallback_action_plan(
        CourtroomActionsRequest(
            matter_title="X",
            matter_type="Civil",
            petitioner_name="P",
            respondent_name="R",
        )
    )
    messy = {
        **fallback,
        "actions": [
            {**fallback["actions"][0], "id": "z", "priority": "low", "title": "Low"},
            {**fallback["actions"][0], "id": "a", "priority": "critical", "title": "Crit"},
            {**fallback["actions"][0], "id": "b", "priority": "high", "title": "High"},
        ]
        + [
            {
                **fallback["actions"][0],
                "id": f"extra-{i}",
                "priority": "medium",
                "title": f"Extra {i}",
            }
            for i in range(12)
        ],
    }
    response = _to_response(messy, fallback)
    assert len(response.actions) <= 10
    assert response.actions[0].priority == "critical"
    assert response.actions[0].title == "Crit"
