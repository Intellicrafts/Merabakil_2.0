"""Agent base class. Each agent is a pure async transform over the state."""

from __future__ import annotations

from abc import ABC, abstractmethod

from legalos_orchestrator.schemas import OrchestratorState


class Agent(ABC):
    name: str = "agent"

    @abstractmethod
    async def run(self, state: OrchestratorState) -> dict:
        """Return a partial state update (LangGraph merges it into the state)."""

    async def __call__(self, state: OrchestratorState) -> dict:
        update = await self.run(state)
        update.setdefault("trace", []).append(self.name)
        return update
