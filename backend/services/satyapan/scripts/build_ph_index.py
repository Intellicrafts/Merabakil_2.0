#!/usr/bin/env python3
"""Build the Bar Council of Punjab & Haryana verification index from BCPH's
published lists (State Roll PDF + bar-association voter lists).

    python scripts/build_ph_index.py [--out data/ph_roll.sqlite] [--skip-voters]

Run on the server monthly (see README). Idempotent: the new index replaces the
old one only after it has been built completely.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time

import certifi
import httpx
import yaml

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.roll_index.punjab_haryana import (  # noqa: E402
    DEFAULT_INDEX_PATH,
    ROLL_COLUMNS,
    VOTERS_INVALID_COLUMNS,
    VOTERS_UPLOADED_COLUMNS,
    IndexBuilder,
    bar_association_of,
    parse_pdf,
    utc_now,
    voter_list_links,
)

URLS_FILE = os.path.join(os.path.dirname(__file__), "..", "app", "core", "urls.yaml")
HEADERS = {"User-Agent": "MeraBakil-Satyapan/1.0 (advocate verification; contact: support@merabakil.in)"}


async def _get(client: httpx.AsyncClient, url: str, attempts: int = 3) -> bytes:
    for attempt in range(1, attempts + 1):
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.content
        except httpx.HTTPError:
            if attempt == attempts:
                raise
            await asyncio.sleep(2 * attempt)
    raise RuntimeError("unreachable")


async def build(out: str, skip_voters: bool) -> int:
    with open(URLS_FILE) as f:
        sources = yaml.safe_load(f)["roll_indexes"]["punjab_haryana"]
    builder = IndexBuilder()
    started = time.time()
    async with httpx.AsyncClient(verify=certifi.where(), headers=HEADERS, timeout=180, follow_redirects=True) as client:
        print(f"Fetching State Roll: {sources['roll_pdf']}")
        roll = await _get(client, sources["roll_pdf"])
        rows = await asyncio.to_thread(parse_pdf, roll, ROLL_COLUMNS)
        builder.add_roll_rows(rows)
        print(f"  roll rows: {builder.stats.roll_rows} (skipped {builder.stats.roll_skipped})")

        uploaded, invalid = [], []
        if not skip_voters:
            page = (await _get(client, sources["voter_lists_page"])).decode("utf-8", "replace")
            uploaded, invalid = voter_list_links(page)
            print(f"Voter lists: {len(uploaded)} uploaded, {len(invalid)} invalid")
            gate = asyncio.Semaphore(4)  # be gentle with BCPH's server

            async def one(url: str, spec):
                async with gate:
                    try:
                        return url, await asyncio.to_thread(parse_pdf, await _get(client, url), spec)
                    except Exception as exc:  # one bad PDF must not stop the build
                        builder.stats.pdfs_failed.append(f"{url} ({type(exc).__name__})")
                        return url, []

            for url, rows in await asyncio.gather(*(one(u, VOTERS_UPLOADED_COLUMNS) for u in uploaded)):
                builder.add_voter_rows(rows, bar_association_of(url))
            # Invalid lists last: BCPH's record status overrides everything else.
            for url, rows in await asyncio.gather(*(one(u, VOTERS_INVALID_COLUMNS) for u in invalid)):
                builder.add_invalid_rows(rows, bar_association_of(url))

    s = builder.stats
    if s.roll_rows < 100_000:
        print(f"Refusing to publish: only {s.roll_rows} roll rows parsed (expected ~134k).")
        return 1
    builder.write(out, {
        "built_at": utc_now(),
        "roll_source": sources["roll_pdf"],
        "voter_lists_source": "" if skip_voters else sources["voter_lists_page"],
        "roll_rows": str(s.roll_rows),
        "voter_rows": str(s.voter_rows),
        "voter_only_advocates": str(s.voter_new),
        "invalid_rows": str(s.invalid_rows),
        "advocates": str(len(builder.advocates)),
    })
    print(f"Done in {time.time() - started:.0f}s → {out}")
    print(f"  advocates: {len(builder.advocates)} | from voter lists only: {s.voter_new} | "
          f"status rows: {s.invalid_rows} | voter PDFs: {len(uploaded)}+{len(invalid)}")
    for failure in s.pdfs_failed:
        print(f"  ⚠ could not read {failure}")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=DEFAULT_INDEX_PATH)
    parser.add_argument("--skip-voters", action="store_true", help="State Roll only (faster, for testing)")
    args = parser.parse_args()
    sys.exit(asyncio.run(build(args.out, args.skip_voters)))


if __name__ == "__main__":
    main()
