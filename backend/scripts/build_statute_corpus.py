"""Build Saarthi's public legal corpus as JSONL (one document per line).

Sources:
  - raw-data/ priority sources (Constitution, law database CSV, amendments, repealed laws)
  - raw-data/bare-acts/<key>.pdf for every act in bare_acts.ACTS that you have downloaded

Usage:
  python backend/scripts/build_statute_corpus.py --out corpus.jsonl
  python backend/scripts/build_statute_corpus.py --only bns --only bnss --out bns.jsonl

Then load it with load_corpus.py (runs inside the ingestion container).
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from bare_acts import ACTS, parse_bare_act_pdf  # noqa: E402
from corpus_sources import RAW_DATA, list_sources, parse_source  # noqa: E402
from parsers.types import ParsedDocument  # noqa: E402

BARE_ACTS_DIR = RAW_DATA / "bare-acts"

# Highest section number in each act — a parse far below this means the PDF text
# didn't split cleanly and should be checked before loading.
EXPECTED_LAST_SECTION = {
    "bns": 358, "bnss": 531, "bsa": 170, "ipc": 511, "crpc": 484, "iea": 167, "cpc": 158,
    "contract": 238, "sra": 44, "limitation": 32, "tpa": 137, "cpa": 107, "dv": 37,
    "pocso": 46, "hma": 30, "sma": 51, "hsa": 31, "ni": 147, "rti": 31, "it": 94,
    "mv": 217, "rera": 92,
}


def _doc_line(doc: ParsedDocument) -> str:
    return json.dumps(
        {
            "title": doc.title,
            "doc_type": doc.doc_type,
            "jurisdiction": doc.jurisdiction,
            "source_file": doc.source_file,
            "page_count": doc.page_count,
            "citations": doc.citations,
            "content_hash": doc.content_hash,
            "chunks": [asdict(c) for c in doc.chunks],
        },
        ensure_ascii=False,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--only", action="append", default=[], help="bare act key (repeatable)")
    parser.add_argument("--skip-raw-data", action="store_true", help="bare acts only")
    args = parser.parse_args()

    docs: list[ParsedDocument] = []
    warnings: list[str] = []

    if not args.skip_raw_data and not args.only:
        for rel, _kind, _doc_type in list_sources():
            doc = parse_source(rel)
            if doc and doc.chunks:
                # raw-data paths are machine-specific; keep a stable source id
                doc.source_file = f"raw-data/{rel}"
                docs.append(doc)
                print(f"  raw-data  {rel}: {len(doc.chunks)} chunks")

    missing = []
    for act in ACTS:
        if args.only and act.key not in args.only:
            continue
        path = BARE_ACTS_DIR / act.filename
        if not path.is_file():
            missing.append(act)
            continue
        doc = parse_bare_act_pdf(path, act)
        numbers = [
            int("".join(ch for ch in c.metadata.get("section_number", "") if ch.isdigit()) or 0)
            for c in doc.chunks
        ]
        last = max(numbers, default=0)
        expected = EXPECTED_LAST_SECTION.get(act.key)
        flag = ""
        if expected and last < expected * 0.9:
            flag = f"  ⚠ last section {last}, expected ~{expected}"
            warnings.append(f"{act.key}: parsed up to section {last} of ~{expected}")
        docs.append(doc)
        print(f"  bare act  {act.key:<10} {len(doc.chunks):>4} chunks, sections up to {last}{flag}")

    with args.out.open("w", encoding="utf-8") as fh:
        for doc in docs:
            fh.write(_doc_line(doc) + "\n")

    total = sum(len(d.chunks) for d in docs)
    print(f"\nWrote {len(docs)} documents / {total} chunks to {args.out}")
    if missing:
        print("\nNot found in raw-data/bare-acts/ (download them, see README there):")
        for act in missing:
            print(f"  {act.filename:<16} {act.title}\n  {'':<16} {act.source_url}")
    if warnings:
        print("\nCheck these parses before loading:")
        for w in warnings:
            print(f"  {w}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
