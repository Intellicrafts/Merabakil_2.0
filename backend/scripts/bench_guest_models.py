#!/usr/bin/env python3
"""Guest chat benchmark and search-cutoff calibration. Read-only: nothing is written
to Qdrant, Redis or Postgres.

  # 1. Dense-similarity scores of what search returns (to choose SEARCH_MIN_DENSE_SCORE)
  python backend/scripts/bench_guest_models.py --calibrate

  # 2. The 20 typical guest questions through the real guest path (knowledge base
  #    searched first, then the model) for each GUEST_CHAT_MODEL choice
  python backend/scripts/bench_guest_models.py --models pro,pro_low,flash --min-dense-score 0.6

Needs the repo .env (Qdrant + a Gemini key with credit). Embedding or model errors
are reported, never replaced by stub output.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import sys
import time

from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT, ".env"))
os.environ["LLM_USE_STUB"] = "false"
os.environ["EMBEDDING_USE_STUB"] = "false"
sys.path.insert(0, os.path.join(ROOT, "backend", "services", "search"))

from app.application.use_cases import HybridSearchUseCase  # noqa: E402
from app.config import SearchSettings  # noqa: E402
from app.domain.fusion import ScoredHit  # noqa: E402
from app.domain.rerank import LexicalReranker  # noqa: E402
from app.infrastructure.adapters import QdrantHybridAdapter  # noqa: E402
from legalos_common.clients import QdrantVectorClient  # noqa: E402
from legalos_common.clients.llm import _primary_embedding_client  # noqa: E402
from legalos_common.config import get_common_settings  # noqa: E402
from legalos_common.search.sparse_encoder import SparseEncoder  # noqa: E402
from legalos_orchestrator import build_orchestrator  # noqa: E402
from legalos_orchestrator.agent.router import QueryRoute  # noqa: E402
from legalos_orchestrator.schemas import OrchestratorState  # noqa: E402

QUESTIONS = [
    ("cheque_bounce", "My cheque bounced for insufficient funds. What is the time limit and procedure to file a cheque bounce case?"),
    ("tenant_deposit", "My landlord is not returning my security deposit after I vacated the flat. What can I do?"),
    ("legal_notice_reply", "I received a legal notice for recovery of money. How should I reply to it?"),
    ("unpaid_salary", "My employer has not paid my salary for three months. What legal options do I have?"),
    ("consumer_complaint", "I bought a defective phone and the company refuses to replace it. How do I file a consumer complaint?"),
    ("fir_refused", "The police are refusing to register my FIR. What can I do?"),
    ("divorce_maintenance", "How can a wife claim maintenance from her husband during a divorce?"),
    ("property_dispute", "My brothers are denying me a share in our father's ancestral property. What are my rights as a daughter?"),
    ("rera_delay", "The builder has delayed possession of my flat by two years. Can I get a refund with interest under RERA?"),
    ("wrongful_termination", "I was terminated from my job without notice or reason. Is this legal and what can I do?"),
    ("anticipatory_bail", "How do I apply for anticipatory bail if I fear arrest in a false case?"),
    ("domestic_violence", "What protection can a woman get under the domestic violence law?"),
    ("online_fraud", "Money was stolen from my bank account through a UPI fraud. Where do I complain?"),
    ("rent_agreement", "Is it mandatory to register an 11-month rent agreement?"),
    ("motor_accident", "How do I claim compensation after a road accident injury?"),
    ("rti", "How do I file an RTI application and what if I get no reply in 30 days?"),
    ("loan_recovery", "Recovery agents are harassing me for a loan. What are my rights?"),
    ("section80_cpc", "Is a notice under Section 80 CPC mandatory before filing a suit against the government?"),
    ("arrest_rights", "What are my rights if I am arrested by the police?"),
    ("will_succession", "My father died without a will. How is his property divided among his children?"),
]

# Topics the current knowledge base clearly covers — true positives for calibration.
KNOWN_RELEVANT = [
    ("art21", "What does Article 21 of the Constitution protect?"),
    ("art19", "Does freedom of speech under Article 19 have limits?"),
    ("posh", "What should a company do about sexual harassment complaints at the workplace?"),
    ("dpdp", "What are my rights over my personal data under the data protection law?"),
]


def _search_stack(min_dense_score: float):
    settings = SearchSettings()
    settings.search_min_dense_score = min_dense_score
    embedder = _primary_embedding_client(settings.llm)  # no stub fallback
    qdrant = QdrantVectorClient(
        settings.qdrant.qdrant_url, settings.qdrant.qdrant_collection, settings.llm.embedding_dim,
        api_key=settings.qdrant.qdrant_api_key,
    )
    sparse = SparseEncoder()
    sparse.load()
    adapter = QdrantHybridAdapter(qdrant, sparse)
    use_case = HybridSearchUseCase(embedder=embedder, hybrid_store=adapter, reranker=LexicalReranker(), settings=settings)
    return embedder, qdrant, adapter, use_case


async def calibrate(out: str) -> None:
    embedder, qdrant, adapter, _ = _search_stack(0.0)
    reranker = LexicalReranker()
    rows = []
    for group, items in (("typical", QUESTIONS), ("known_relevant", KNOWN_RELEVANT)):
        for key, text in items:
            vector = await embedder.embed_one(text)
            raw = await adapter.search(text, vector, limit=24, filters=None, enforce_access=True)
            hits = reranker.rerank(
                text, [ScoredHit(id=h["id"], payload=h["payload"], score=h["score"], sources={"hybrid"}) for h in raw], top_k=8
            )
            top = [(round(h.payload.get("_dense_score", 0.0), 3), (h.payload.get("title") or "")[:70]) for h in hits]
            rows.append({"group": group, "key": key, "hits": top})
            print(f"\n[{group}] {key}")
            for score, title in top:
                print(f"   {score:.3f}  {title}")
    json.dump(rows, open(out, "w"), indent=1, ensure_ascii=False)
    print(f"\nSaved {out}. Pick the lowest score that still keeps the genuinely relevant hits.")
    await qdrant.close()


class _Retriever:
    def __init__(self, use_case: HybridSearchUseCase) -> None:
        self._use_case = use_case

    async def retrieve(self, query, *, top_k, filters, user_token):
        return await self._use_case.search(query, top_k=top_k, filters=filters)


async def _run_one(orchestrator, question: str) -> dict:
    state = OrchestratorState(query=question, is_guest=True, route=QueryRoute.LEGAL)
    started = time.perf_counter()
    row: dict = {"ttft_s": None, "total_s": None, "suggestions_s": None, "error": None}
    async for chunk in orchestrator.run_state_streaming(state):
        event, _, data = chunk.partition("\ndata: ")
        event = event.removeprefix("event: ")
        elapsed = round(time.perf_counter() - started, 2)
        if event == "token" and row["ttft_s"] is None:
            row["ttft_s"] = elapsed
        elif event == "done":
            payload = json.loads(data)
            row.update(
                total_s=elapsed,
                answer=payload.get("answer", ""),
                kb_retrieved=[s.get("title") for s in payload.get("sources", [])],
                kb_cited=[c.get("marker") for c in payload.get("citations", [])],
            )
        elif event == "suggestions":
            row["suggestions_s"] = elapsed
        elif event == "error":
            row["error"] = json.loads(data).get("code")
    return row


def _stats(values: list[float]) -> str:
    if not values:
        return "–"
    ordered = sorted(values)
    p90 = ordered[min(len(ordered) - 1, int(round(0.9 * (len(ordered) - 1))))]
    return f"{statistics.median(ordered):.1f}s / {p90:.1f}s"


async def bench(models: list[str], min_dense_score: float, out: str) -> None:
    _, qdrant, _, use_case = _search_stack(min_dense_score)
    llm = get_common_settings().llm
    results: dict[str, list[dict]] = {}
    for model in models:
        orchestrator = build_orchestrator(
            retriever=_Retriever(use_case), llm_settings=llm.model_copy(update={"guest_chat_model": model}), llm=None
        )
        results[model] = []
        for key, question in QUESTIONS:
            row = {"key": key, **await _run_one(orchestrator, question)}
            results[model].append(row)
            print(f"{model:8} {key:22} ttft={row['ttft_s']}s total={row['total_s']}s "
                  f"cited={len(row.get('kb_cited', []))}/{len(row.get('kb_retrieved', []))} {row['error'] or ''}")
    json.dump(results, open(out, "w"), indent=1, ensure_ascii=False)

    print("\n| model | TTFT median / p90 | total median / p90 | errors | answers citing the KB |")
    print("|---|---|---|---|---|")
    for model, rows in results.items():
        ok = [r for r in rows if not r["error"]]
        print(f"| {model} | {_stats([r['ttft_s'] for r in ok if r['ttft_s']])} | "
              f"{_stats([r['total_s'] for r in ok if r['total_s']])} | {len(rows) - len(ok)} | "
              f"{sum(1 for r in ok if r.get('kb_cited'))}/{len(ok)} |")
    print(f"\nFull answers saved to {out} for the quality review.")
    await qdrant.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--calibrate", action="store_true")
    parser.add_argument("--models", default="pro,pro_low,flash")
    parser.add_argument("--min-dense-score", type=float, default=0.0)
    parser.add_argument("--out", default="guest_bench.json")
    args = parser.parse_args()
    if args.calibrate:
        asyncio.run(calibrate(args.out.replace(".json", "_calibration.json")))
    else:
        asyncio.run(bench([m.strip() for m in args.models.split(",") if m.strip()], args.min_dense_score, args.out))


if __name__ == "__main__":
    main()
