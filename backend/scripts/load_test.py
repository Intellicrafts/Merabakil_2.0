"""Load test script for search and research endpoints (k6-style via httpx)."""

from __future__ import annotations

import argparse
import asyncio
import statistics
import time

import httpx


async def _bench(
    client: httpx.AsyncClient,
    *,
    url: str,
    json: dict,
    headers: dict,
    n: int,
) -> list[float]:
    times: list[float] = []
    for _ in range(n):
        start = time.perf_counter()
        resp = await client.post(url, json=json, headers=headers)
        resp.raise_for_status()
        times.append(time.perf_counter() - start)
    return times


def _report(label: str, times: list[float]) -> None:
    p95 = sorted(times)[int(len(times) * 0.95) - 1] if times else 0
    print(
        f"{label}: n={len(times)} mean={statistics.mean(times):.3f}s "
        f"p95={p95:.3f}s max={max(times):.3f}s"
    )


async def main() -> None:
    parser = argparse.ArgumentParser(description="Legal OS load smoke test")
    parser.add_argument("--token", required=True)
    parser.add_argument("--search-url", default="http://localhost:8003")
    parser.add_argument("--research-url", default="http://localhost:8004")
    parser.add_argument("-n", type=int, default=10)
    args = parser.parse_args()
    headers = {"Authorization": f"Bearer {args.token}"}

    async with httpx.AsyncClient(timeout=60.0) as client:
        search_times = await _bench(
            client,
            url=f"{args.search_url}/api/v1/search",
            json={"query": "valid contract India", "top_k": 5, "mode": "hybrid"},
            headers=headers,
            n=args.n,
        )
        research_times = await _bench(
            client,
            url=f"{args.research_url}/api/v1/research",
            json={"query": "What makes a contract valid in India?"},
            headers=headers,
            n=args.n,
        )
    _report("search", search_times)
    _report("research", research_times)


if __name__ == "__main__":
    asyncio.run(main())
