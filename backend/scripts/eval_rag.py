#!/usr/bin/env python3
"""RAG evaluation harness — benchmark retrieval and research answer quality."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from dataclasses import dataclass

import httpx
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT, ".env"))

BENCHMARKS: list[dict[str, str | list[str]]] = [
    {
        "query": "What is Article 19 of the Indian Constitution?",
        "must_contain": ["Article 19", "speech", "freedom"],
    },
    {
        "query": "Explain the basic structure doctrine from Kesavananda Bharati case",
        "must_contain": ["Kesavananda", "basic structure"],
    },
    {
        "query": "What changed with Bharatiya Nyaya Sanhita 2023 replacing IPC?",
        "must_contain": ["BNS", "2024"],
    },
    {
        "query": "What are fundamental rights under Part III?",
        "must_contain": ["Part III", "rights"],
    },
    {
        "query": "Shreya Singhal v Union of India Section 66A IT Act",
        "must_contain": ["Shreya Singhal", "66A"],
    },
    {
        "query": "What is Article 21 right to life and personal liberty?",
        "must_contain": ["Article 21", "life"],
    },
    {
        "query": "Explain Article 14 equality before law",
        "must_contain": ["Article 14", "equality"],
    },
    {
        "query": "What is the Preamble of the Indian Constitution?",
        "must_contain": ["Preamble", "India"],
    },
    {
        "query": "Zero FIR under BNSS criminal procedure",
        "must_contain": ["FIR", "BNSS"],
    },
    {
        "query": "Right to privacy Puttaswamy judgment",
        "must_contain": ["privacy", "Puttaswamy"],
    },
]


@dataclass
class EvalResult:
    query: str
    search_hits: int
    search_ok: bool
    research_ok: bool
    answer_snippet: str
    keyword_hits: list[str]
    missing_keywords: list[str]


async def _login(auth_url: str, email: str, password: str) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{auth_url}/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def _search(search_url: str, token: str, query: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            f"{search_url}/api/v1/search",
            json={"query": query, "top_k": 5, "mode": "hybrid"},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json().get("results", [])


async def _research(research_url: str, token: str, query: str) -> dict:
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{research_url}/api/v1/research",
            json={"query": query},
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def run_eval(
    *,
    auth_url: str,
    search_url: str,
    research_url: str,
    email: str,
    password: str,
) -> list[EvalResult]:
    token = await _login(auth_url, email, password)
    results: list[EvalResult] = []

    for bench in BENCHMARKS:
        query = str(bench["query"])
        must = [str(k).lower() for k in bench["must_contain"]]

        try:
            hits = await _search(search_url, token, query)
            search_ok = len(hits) > 0
        except Exception:
            hits = []
            search_ok = False

        try:
            research = await _research(research_url, token, query)
            answer = (research.get("answer") or "").lower()
            research_ok = bool(answer)
            snippet = (research.get("answer") or "")[:200]
        except Exception:
            answer = ""
            research_ok = False
            snippet = ""

        combined = answer + " " + " ".join(
            (h.get("content") or h.get("title") or "") for h in hits
        ).lower()
        keyword_hits = [k for k in must if k.lower() in combined]
        missing = [k for k in must if k.lower() not in combined]

        results.append(
            EvalResult(
                query=query,
                search_hits=len(hits),
                search_ok=search_ok,
                research_ok=research_ok,
                answer_snippet=snippet,
                keyword_hits=keyword_hits,
                missing_keywords=missing,
            )
        )

    return results


def _print_report(results: list[EvalResult]) -> int:
    search_pass = sum(1 for r in results if r.search_ok)
    research_pass = sum(1 for r in results if r.research_ok)
    keyword_pass = sum(1 for r in results if not r.missing_keywords)

    print("\n=== RAG Evaluation Report ===\n")
    for r in results:
        status = "PASS" if not r.missing_keywords and r.research_ok else "WARN"
        print(f"[{status}] {r.query}")
        print(f"  search_hits={r.search_hits} keywords={r.keyword_hits} missing={r.missing_keywords}")
        if r.answer_snippet:
            print(f"  answer: {r.answer_snippet[:120]}...")
        print()

    print(
        f"Summary: search={search_pass}/{len(results)} "
        f"research={research_pass}/{len(results)} "
        f"keywords={keyword_pass}/{len(results)}"
    )
    return 0 if research_pass >= len(results) * 0.7 else 1


async def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate RAG retrieval and research quality")
    parser.add_argument(
        "--auth-url",
        default=os.getenv("AUTH_SERVICE_URL", "http://localhost:8001").replace("://auth:", "://localhost:").replace("http://auth", "http://localhost"),
    )
    parser.add_argument(
        "--search-url",
        default=os.getenv("SEARCH_SERVICE_URL", "http://localhost:8003").replace("://search:", "://localhost:").replace("http://search", "http://localhost"),
    )
    parser.add_argument(
        "--research-url",
        default=os.getenv("RESEARCH_SERVICE_URL", "http://localhost:8004").replace("://research:", "://localhost:").replace("http://research", "http://localhost"),
    )
    parser.add_argument("--email", default=os.getenv("SEED_ADMIN_EMAIL", "admin@legalos.in"))
    parser.add_argument("--password", default=os.getenv("SEED_ADMIN_PASSWORD", "ChangeMe!2026"))
    parser.add_argument("--json", action="store_true", help="Output JSON report")
    args = parser.parse_args()

    try:
        results = await run_eval(
            auth_url=args.auth_url,
            search_url=args.search_url,
            research_url=args.research_url,
            email=args.email,
            password=args.password,
        )
    except Exception as exc:
        print(f"Eval failed: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(json.dumps([r.__dict__ for r in results], indent=2))
    return _print_report(results)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
