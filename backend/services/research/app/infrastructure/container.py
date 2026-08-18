from __future__ import annotations

import redis.asyncio as aioredis
from qdrant_client import AsyncQdrantClient

from app.config import ResearchSettings
from app.infrastructure.memory import (
    ConversationSummarizer,
    LongTermMemory,
    MemoryManager,
    SessionMemory,
)
from app.infrastructure.search_retriever import HttpSearchRetriever
from app.infrastructure.specialist_clients import HttpSpecialistClient
from legalos_common.clients import build_embedding_client, build_llm_client, build_tts_client
from legalos_orchestrator import build_orchestrator
from legalos_orchestrator.agent.router import QueryRouter
from legalos_orchestrator.graph import LegalOrchestrator


class Container:
    def __init__(self, settings: ResearchSettings) -> None:
        self.settings = settings
        self.llm = build_llm_client(settings.llm)
        self.tts = build_tts_client(settings.llm)
        self.embedder = build_embedding_client(settings.llm)
        self.retriever = HttpSearchRetriever(
            settings.search_service_url, timeout=settings.search_timeout_seconds
        )
        self.contract_review = HttpSpecialistClient(
            settings.contract_review_service_url, "/api/v1/contract-review/analyze"
        )
        self.litigation = HttpSpecialistClient(
            settings.litigation_service_url, "/api/v1/litigation/strategy"
        )
        self.router = QueryRouter(
            model=settings.llm.llm_router_model,
            api_key=settings.llm.llm_api_key,
        )
        self.orchestrator: LegalOrchestrator = build_orchestrator(
            retriever=self.retriever,
            llm_settings=settings.llm,
            llm=self.llm,
            contract_review=self.contract_review,
            litigation=self.litigation,
        )

        # Memory layer — uses platform Redis + Qdrant
        redis_client = self._build_redis(settings.redis_url)
        qdrant_client = AsyncQdrantClient(url=settings.qdrant.qdrant_url)
        summarizer = ConversationSummarizer(self.llm)
        ltm = LongTermMemory(
            qdrant_client,
            self.embedder,
            collection=settings.qdrant_ltm_collection,
            dedup_threshold=settings.ltm_dedup_threshold,
        )
        session = SessionMemory(
            redis_client,
            ttl=settings.session_ttl_seconds,
            max_turns=settings.session_max_turns,
            summarizer=summarizer,
        )
        self.memory_manager = MemoryManager(session, ltm, summarizer)
        self._qdrant_ltm = qdrant_client
        self._ltm = ltm

    @staticmethod
    def _build_redis(url: str):
        try:
            return aioredis.from_url(url, decode_responses=False)
        except Exception:
            return None

    async def startup(self) -> None:
        """Ensure the LTM Qdrant collection exists at startup."""
        try:
            dim = self.settings.llm.embedding_dim
            await self._ltm.ensure_collection(dim)
        except Exception:
            pass

    async def shutdown(self) -> None:
        await self.retriever.close()
        await self.contract_review.close()
        await self.litigation.close()
        await self._qdrant_ltm.close()


_container: Container | None = None


def init_container(settings: ResearchSettings) -> Container:
    global _container
    _container = Container(settings)
    return _container


def get_container() -> Container:
    if _container is None:
        raise RuntimeError("Container not initialised")
    return _container
