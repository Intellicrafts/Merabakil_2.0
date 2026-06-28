from __future__ import annotations

from app.config import ResearchSettings
from app.infrastructure.search_retriever import HttpSearchRetriever
from app.infrastructure.specialist_clients import HttpSpecialistClient
from legalos_common.clients import build_llm_client, build_tts_client
from legalos_orchestrator import build_orchestrator
from legalos_orchestrator.graph import LegalOrchestrator


class Container:
    def __init__(self, settings: ResearchSettings) -> None:
        self.settings = settings
        self.llm = build_llm_client(settings.llm)
        self.tts = build_tts_client(settings.llm)
        self.retriever = HttpSearchRetriever(
            settings.search_service_url, timeout=settings.search_timeout_seconds
        )
        self.contract_review = HttpSpecialistClient(
            settings.contract_review_service_url, "/api/v1/contract-review/analyze"
        )
        self.litigation = HttpSpecialistClient(
            settings.litigation_service_url, "/api/v1/litigation/strategy"
        )
        self.orchestrator: LegalOrchestrator = build_orchestrator(
            retriever=self.retriever,
            llm=self.llm,
            contract_review=self.contract_review,
            litigation=self.litigation,
        )

    async def shutdown(self) -> None:
        await self.retriever.close()
        await self.contract_review.close()
        await self.litigation.close()


_container: Container | None = None


def init_container(settings: ResearchSettings) -> Container:
    global _container
    _container = Container(settings)
    return _container


def get_container() -> Container:
    if _container is None:
        raise RuntimeError("Container not initialised")
    return _container
