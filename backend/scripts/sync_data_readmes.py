#!/usr/bin/env python3
"""Regenerate data/*/README.md from corpus_registry.yaml."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend" / "libs" / "legalos_common"))

from legalos_common.corpus.registry import load_corpus_registry  # noqa: E402


def main() -> None:
    registry = load_corpus_registry(ROOT / "data" / "corpus_registry.yaml")
    data_dir = ROOT / "data"
    for cat in registry.categories:
        folder = data_dir / cat.folder
        folder.mkdir(parents=True, exist_ok=True)
        readme = folder / "README.md"
        readme.write_text(cat.to_readme(), encoding="utf-8")
        print(f"Wrote {readme}")
    print(f"Synced {len(registry.categories)} README files.")


if __name__ == "__main__":
    main()
