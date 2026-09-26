from __future__ import annotations

import json
import os

os.environ.setdefault("LLM_API_KEY", "test-key")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from legalos_common.rag.schemas import Citation, ConfidenceBreakdown, RetrievedSource
from legalos_common.security import create_access_token
from legalos_orchestrator.agent.router import QueryRoute
from legalos_orchestrator.schemas import Intent, JurisdictionResult, OrchestratorResult, OrchestratorState


class FakeRedis:
    """Just enough of redis.asyncio for rate limits, session memory and docs."""

    def __init__(self) -> None:
        self.kv: dict[str, object] = {}

    # strings / counters
    async def get(self, key):
        return self.kv.get(key)

    async def set(self, key, value, ex=None):
        self.kv[key] = value

    async def delete(self, *keys):
        return sum(1 for k in keys if self.kv.pop(k, None) is not None)

    async def expire(self, key, seconds, nx=False):
        return True

    def pipeline(self, transaction=False):
        return _FakePipeline(self)

    # lists
    async def rpush(self, key, value):
        self.kv.setdefault(key, []).append(value)

    async def lrange(self, key, start, end):
        items = self.kv.get(key, [])
        return items[start:] if end == -1 else items[start : end + 1]

    async def llen(self, key):
        return len(self.kv.get(key, []))

    async def ltrim(self, key, start, end):
        self.kv[key] = self.kv.get(key, [])[start : end + 1]

    # hashes
    async def hset(self, key, mapping):
        self.kv.setdefault(key, {}).update(
            {k.encode() if isinstance(k, str) else k: (v.encode() if isinstance(v, str) else v) for k, v in mapping.items()}
        )

    async def hgetall(self, key):
        value = self.kv.get(key)
        return dict(value) if isinstance(value, dict) else {}

    async def scan_iter(self, match="*"):
        import fnmatch

        for key in list(self.kv):
            if fnmatch.fnmatch(key, match):
                yield key

    # sets
    async def sadd(self, key, value):
        self.kv.setdefault(key, set()).add(value)

    async def smembers(self, key):
        return set(self.kv.get(key, set()))

    async def srem(self, key, value):
        self.kv.get(key, set()).discard(value)


class _FakePipeline:
    def __init__(self, redis: FakeRedis) -> None:
        self.redis = redis
        self.ops: list = []

    def incr(self, key):
        self.ops.append(("incr", key))

    def expire(self, *args, **kwargs):
        self.ops.append(("noop", None))

    def delete(self, key):
        self.ops.append(("delete", key))

    def rpush(self, key, value):
        self.ops.append(("rpush", (key, value)))

    async def execute(self):
        out = []
        for op, arg in self.ops:
            if op == "incr":
                self.redis.kv[arg] = int(self.redis.kv.get(arg, 0)) + 1
                out.append(self.redis.kv[arg])
            elif op == "delete":
                self.redis.kv.pop(arg, None)
                out.append(1)
            elif op == "rpush":
                self.redis.kv.setdefault(arg[0], []).append(arg[1])
                out.append(1)
            else:
                out.append(True)
        return out


class FakeRouter:
    def quick_classify(self, query: str):
        return QueryRoute.CONVERSATIONAL if query.strip().lower() in {"hi", "hello", "yes", "thanks"} else None

    async def classify(self, query: str):
        return QueryRoute.LEGAL


class FakeLTM:
    async def retrieve_relevant(self, user_id, query, top_k=3):
        return []

    async def store_fact(self, **kwargs):
        return None

    async def delete_facts(self, user_id, session_id=None):
        return None


class FakeSummarizer:
    async def extract_long_term_facts(self, turns):
        return []

    async def summarize_turns(self, turns):
        return "summary"


class FakeEmbedder:
    """Deterministic bag-of-words vectors — enough to rank passages by topic."""

    DIM = 256

    def __init__(self) -> None:
        self.calls = 0

    def _vec(self, text: str) -> list[float]:
        import hashlib
        import re

        v = [0.0] * self.DIM
        for word in re.findall(r"[a-z]{3,}", text.lower()):
            v[int(hashlib.md5(word.encode()).hexdigest(), 16) % self.DIM] += 1.0
        return v

    async def embed(self, texts):
        self.calls += 1
        return [self._vec(t) for t in texts]

    async def embed_one(self, text):
        self.calls += 1
        return self._vec(text)


class FakeDocumentTexts:
    """Stands in for the document service: each file is readable by its owner's token only."""

    def __init__(self) -> None:
        self.docs: dict[str, tuple[str, str, str]] = {}  # id -> (owner_token, title, text)

    def add(self, doc_id: str, *, owner_token: str, title: str, text: str) -> None:
        self.docs[doc_id] = (owner_token, title, text)

    async def fetch_full(self, document_id, *, user_token):
        doc = self.docs.get(document_id)
        if not doc or doc[0] != user_token:
            return None
        return doc[1], doc[2]

    async def can_access(self, document_id, *, user_token):
        return (await self.fetch_full(document_id, user_token=user_token)) is not None


class RecordingBilling:
    def __init__(self) -> None:
        self.deductions: list[dict] = []
        self.balance_ok = True

    async def has_balance(self, *, user_token, minimum):
        return self.balance_ok

    async def deduct_chatbot_query(self, **kwargs):
        self.deductions.append(kwargs)
        return True


_SOURCE = RetrievedSource(
    chunk_id="d1:0",
    document_id="d1",
    title="Indian Contract Act, 1872",
    citation="Act 9 of 1872",
    section="10",
    content="What agreements are contracts: free consent, lawful consideration...",
    score=0.91,
)

FIXED_RESULT = OrchestratorResult(
    query="What makes an agreement a valid contract in India?",
    intent=Intent.LEGAL_RESEARCH,
    jurisdiction=JurisdictionResult(),
    answer="Grounded legal answer citing [KB-1].",
    sources=[_SOURCE],
    web_sources=[],
    web_images=[],
    suggestions=["What is free consent?", "What is lawful consideration?", "Is consideration mandatory?"],
    citations=[Citation(marker="[KB-1]", title="Indian Contract Act, 1872", citation="Act 9 of 1872", document_id="d1", section="10")],
    confidence=ConfidenceBreakdown(retrieval_strength=0.91, source_agreement=1.0, coverage=0.2, overall=0.67),
    trace=[],
    specialist_payload={},
)


class MockOrchestrator:
    """Scriptable stand-in for LegalOrchestrator.run_state_streaming."""

    def __init__(self) -> None:
        self.mode = "agent"  # "agent" | "conversational" | "error" | "raise"
        self.answer = FIXED_RESULT.answer
        self.states: list[OrchestratorState] = []

    async def run_state_streaming(self, state: OrchestratorState):
        self.states.append(state)
        yield f"event: status\ndata: {json.dumps({'stage': 'thinking', 'message': 'Analysing…'})}\n\n"
        if self.mode == "raise":
            raise RuntimeError("boom: internal detail")
        if self.mode == "error":
            yield f"event: error\ndata: {json.dumps({'code': 'ai_unavailable', 'message': ''})}\n\n"
            return
        yield f"event: token\ndata: {json.dumps({'text': self.answer})}\n\n"
        payload = FIXED_RESULT.model_copy(update={"answer": self.answer}).model_dump(mode="json")
        payload["mode"] = self.mode
        yield f"event: citations\ndata: {json.dumps(payload)}\n\n"
        yield f"event: done\ndata: {json.dumps(payload)}\n\n"


def parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.strip().split("\n\n"):
        if not block.startswith("event: "):
            continue  # keepalive comments
        head, _, data = block.partition("\ndata: ")
        events.append((head.removeprefix("event: "), json.loads(data)))
    return events


@pytest.fixture
def access_token() -> str:
    return create_access_token("user-1", roles=["citizen"], permissions=["research:read"])


@pytest.fixture
def other_user_token() -> str:
    return create_access_token("user-2", roles=["citizen"], permissions=["research:read"])


@pytest.fixture
def env():
    """The container wired with in-memory fakes; yields handles for assertions."""
    import app.main  # noqa: F401 — initialises the container
    from app.api import chat_pipeline
    from app.infrastructure import container as container_mod
    from app.infrastructure.memory import MemoryManager, SessionMemory

    container = container_mod.get_container()
    redis = FakeRedis()
    orchestrator = MockOrchestrator()
    billing = RecordingBilling()

    saved = {
        "orchestrator": container.orchestrator,
        "router": container.router,
        "redis": container.redis,
        "memory_manager": container.memory_manager,
        "session_documents": container.session_documents,
        "billing": chat_pipeline.billing,
    }
    from app.infrastructure.memory.session_documents import SessionDocuments

    from app.infrastructure.doc_index import DocumentContext

    texts = FakeDocumentTexts()
    saved["doc_context"] = container.doc_context
    saved["document_texts"] = container.document_texts
    container.document_texts = texts
    container.doc_context = DocumentContext(redis, FakeEmbedder(), texts, ttl=7200)
    container.orchestrator = orchestrator
    container.router = FakeRouter()
    container.redis = redis
    container.session_documents = SessionDocuments(redis)
    container.memory_manager = MemoryManager(
        SessionMemory(redis, ttl=7200, max_turns=10, summarizer=None), FakeLTM(), FakeSummarizer()
    )
    chat_pipeline.billing = billing

    class Handles:
        pass

    h = Handles()
    h.redis, h.orchestrator, h.billing, h.container = redis, orchestrator, billing, container
    h.texts = texts
    yield h

    for key, value in saved.items():
        if key == "billing":
            chat_pipeline.billing = value
        else:
            setattr(container, key, value)


@pytest_asyncio.fixture
async def client(env):
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
