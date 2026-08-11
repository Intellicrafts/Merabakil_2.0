#!/usr/bin/env python3
"""Search service — native mode with raw-data corpus + real Gemini embeddings."""
from __future__ import annotations

import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "backend" / "scripts"))
from dev_bootstrap import bootstrap_dev_env  # noqa: E402

bootstrap_dev_env(_ROOT)

sys.path[:0] = [
    str(_ROOT / "backend" / "libs" / "legalos_common"),
    str(_ROOT / "backend" / "services" / "search"),
    str(_ROOT / "backend" / "services" / "knowledge-ingestion"),
    str(_ROOT / "backend" / "scripts"),
]

from fastapi import Depends, FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.api.schemas import SearchRequest, SearchResponse  # noqa: E402
from app.application.use_cases import HybridSearchUseCase, SearchMode  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.domain.rerank import LexicalReranker  # noqa: E402
from dev_corpus import CORPUS, MemKeywordStore, MemVectorStore  # noqa: E402
from dev_corpus_loader import load_raw_data_corpus  # noqa: E402
from legalos_common.api import build_health_router, register_exception_handlers  # noqa: E402
from legalos_common.clients.llm import StubEmbeddingClient, build_embedding_client  # noqa: E402
from legalos_common.security.rbac import Permission, require_permissions  # noqa: E402

settings = get_settings()

print("Loading raw-data/ corpus...", flush=True)
try:
    _CORPUS = load_raw_data_corpus(include_pdfs=True)
    print(f"Loaded {len(_CORPUS)} chunks from raw-data/", flush=True)
except Exception as exc:
    print(f"raw-data load failed ({exc}), using built-in sample corpus", flush=True)
    _CORPUS = CORPUS

_use_stub = settings.llm.llm_use_stub or settings.llm.embedding_use_stub
_embed_dim = settings.llm.embedding_dim
embedder = StubEmbeddingClient(_embed_dim) if _use_stub else build_embedding_client(settings.llm)
if _use_stub:
    print("WARNING: embedding stub active — set EMBEDDING_USE_STUB=false for real vectors", flush=True)
else:
    print(f"Using live embeddings: {settings.llm.embedding_model}", flush=True)

vector = MemVectorStore(embedder, _CORPUS)
keyword = MemKeywordStore(_CORPUS)
search_uc = HybridSearchUseCase(
    embedder=embedder,
    vector_store=vector,
    keyword_store=keyword,
    reranker=LexicalReranker(),
    settings=settings,
)

app = FastAPI(title="AI Legal OS - Search (native)", version="0.1.0-native")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
register_exception_handlers(app)
app.include_router(build_health_router(settings.service_name))


def _switch_to_stub_embeddings(reason: str) -> None:
    """Keep the native stack up when the live embedding provider is unavailable."""
    global embedder, vector, search_uc
    print(f"WARNING: live embeddings failed ({reason})", flush=True)
    print("WARNING: falling back to offline stub embeddings so search can start", flush=True)
    print(
        "WARNING: fix Google Cloud billing / API key, or set EMBEDDING_USE_STUB=true in .env",
        flush=True,
    )
    embedder = StubEmbeddingClient(_embed_dim)
    vector = MemVectorStore(embedder, _CORPUS)
    search_uc = HybridSearchUseCase(
        embedder=embedder,
        vector_store=vector,
        keyword_store=keyword,
        reranker=LexicalReranker(),
        settings=settings,
    )


@app.on_event("startup")
async def _warm_index() -> None:
    print(f"Embedding {len(_CORPUS)} chunks (this may take a few minutes)...", flush=True)
    try:
        await vector.warm()
    except Exception as exc:
        if _use_stub:
            raise
        _switch_to_stub_embeddings(str(exc)[:300])
        await vector.warm()
    print("Search index ready.", flush=True)


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

    print("Search (native) http://localhost:8003/docs")
    uvicorn.run(app, host="0.0.0.0", port=8003, log_level="info")
