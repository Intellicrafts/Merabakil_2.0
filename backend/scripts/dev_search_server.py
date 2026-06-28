#!/usr/bin/env python3
"""Search service — dev mode (in-memory corpus, no Qdrant/OpenSearch)."""
from __future__ import annotations

import os
import sys

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
sys.path[:0] = [
    os.path.join(_ROOT, "backend", "libs", "legalos_common"),
    os.path.join(_ROOT, "backend", "services", "search"),
    os.path.join(_ROOT, "backend", "scripts"),
]

os.environ.setdefault("LLM_USE_STUB", "true")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")
os.environ.setdefault("JWT_SECRET_KEY", "dev-local-secret")
os.environ.setdefault(
    "FIELD_ENCRYPTION_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
)

from fastapi import Depends, FastAPI  # noqa: E402

from app.api.schemas import SearchRequest, SearchResponse  # noqa: E402
from app.application.use_cases import HybridSearchUseCase, SearchMode  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.domain.rerank import LexicalReranker  # noqa: E402
from legalos_common.api import build_health_router, register_exception_handlers  # noqa: E402
from legalos_common.clients.llm import StubEmbeddingClient  # noqa: E402
from legalos_common.security.rbac import Permission, require_permissions  # noqa: E402
from dev_corpus import CORPUS, MemKeywordStore, MemVectorStore  # noqa: E402

settings = get_settings()
embedder = StubEmbeddingClient(settings.llm.embedding_dim)
vector = MemVectorStore(embedder, CORPUS)
keyword = MemKeywordStore(CORPUS)
search_uc = HybridSearchUseCase(
    embedder=embedder,
    vector_store=vector,
    keyword_store=keyword,
    reranker=LexicalReranker(),
    settings=settings,
)

app = FastAPI(title="AI Legal OS - Search (dev)", version="0.1.0-dev")
register_exception_handlers(app)
app.include_router(build_health_router(settings.service_name))


@app.on_event("startup")
async def _warm_index() -> None:
    await vector.warm()


@app.post("/api/v1/search", response_model=SearchResponse)
async def search(
    body: SearchRequest,
    _=Depends(require_permissions(Permission.SEARCH_READ.value)),
):
    results = await search_uc.search(
        body.query, top_k=body.top_k, mode=body.mode, filters=body.filters() or None
    )
    return SearchResponse(query=body.query, mode=body.mode, count=len(results), results=results)


if __name__ == "__main__":
    import uvicorn

    print("Search (dev) http://localhost:8003/docs")
    uvicorn.run(app, host="0.0.0.0", port=8003, log_level="info")
