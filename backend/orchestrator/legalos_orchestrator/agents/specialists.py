"""Specialist agents with optional Phase 2 service integration."""

from __future__ import annotations

from legalos_orchestrator.agents.base import Agent
from legalos_orchestrator.ports import SpecialistPort
from legalos_orchestrator.schemas import OrchestratorState


class _AdvisoryAgent(Agent):
    advisory: str = ""

    async def run(self, state: OrchestratorState) -> dict:
        notes = dict(state.metadata)
        notes.setdefault("specialist_notes", [])
        notes["specialist_notes"] = [*notes["specialist_notes"], {self.name: self.advisory}]
        return {"metadata": notes}


class _ServiceBackedAgent(Agent):
    advisory: str = ""
    service_name: str = ""

    def __init__(self, service: SpecialistPort | None = None) -> None:
        self._service = service

    async def run(self, state: OrchestratorState) -> dict:
        notes = dict(state.metadata)
        notes.setdefault("specialist_notes", [])
        notes["specialist_notes"] = [*notes["specialist_notes"], {self.name: self.advisory}]

        if self._service is not None:
            doc_id = state.search_filters.document_id
            if state.search_filters.document_ids and not doc_id:
                doc_id = state.search_filters.document_ids[0]
            try:
                result = await self._service.analyze(
                    query=state.query,
                    facts=state.answer or None,
                    document_id=doc_id,
                    user_token=state.user_token,
                )
                notes["specialist_result"] = result
            except Exception:
                pass

        return {"metadata": notes}


class LitigationAgent(_ServiceBackedAgent):
    name = "litigation_agent"
    advisory = (
        "Identify the correct forum and limitation period before filing; verify "
        "pecuniary and territorial jurisdiction against the retrieved authorities."
    )


class DraftingAgent(_AdvisoryAgent):
    name = "drafting_agent"
    advisory = (
        "Use the relevant legal template, fill statutory references from the cited "
        "sources, and have a licensed advocate review before service or filing."
    )


class ContractReviewAgent(_ServiceBackedAgent):
    name = "contract_review_agent"
    advisory = (
        "Extract clauses, flag missing indemnity/limitation-of-liability/termination "
        "provisions, and assess risk against the cited statutory positions."
    )


class EvidenceAgent(_AdvisoryAgent):
    name = "evidence_agent"
    advisory = (
        "Assess admissibility under the Bharatiya Sakshya Adhiniyam / Evidence Act and "
        "establish a clear chain of custody for each exhibit."
    )


class ComplianceAgent(_AdvisoryAgent):
    name = "compliance_agent"
    advisory = (
        "Map obligations to the applicable regulator (RBI/SEBI/MCA/GST/Labour/DPDP) and "
        "track filing deadlines derived from the cited rules and circulars."
    )


class LawyerMatchingAgent(_AdvisoryAgent):
    name = "lawyer_matching_agent"
    advisory = (
        "Match the matter's practice area and jurisdiction to verified advocates in the "
        "marketplace, ranked by experience and rating."
    )
