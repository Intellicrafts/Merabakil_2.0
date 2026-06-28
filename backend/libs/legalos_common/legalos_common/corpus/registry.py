"""Load and validate the legal corpus category registry."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, Field


class CorpusCategory(BaseModel):
    folder: str
    doc_type: str
    jurisdiction: str = "india"
    purpose: str
    answers_for: list[str] = Field(default_factory=list)
    pdf_examples: list[str] = Field(default_factory=list)
    recommended_min_pdfs: int = 1
    recommended_optimal_pdfs: int = 10
    ingestion_tips: str = ""

    def to_readme(self) -> str:
        """Render human-readable README content for the data/ subfolder."""
        lines = [
            f"# {self.folder}",
            "",
            self.purpose,
            "",
            "## What answers this data improves",
            "",
        ]
        lines.extend(f"- {item}" for item in self.answers_for)
        lines.extend(
            [
                "",
                "## Example PDFs to upload",
                "",
            ]
        )
        lines.extend(f"- {ex}" for ex in self.pdf_examples)
        lines.extend(
            [
                "",
                "## Corpus sizing",
                "",
                f"- **Minimum recommended:** {self.recommended_min_pdfs} PDFs",
                f"- **Optimal for best RAG output:** {self.recommended_optimal_pdfs} PDFs",
                "",
                "## Ingestion metadata",
                "",
                f"- **doc_type:** `{self.doc_type}`",
                f"- **jurisdiction:** `{self.jurisdiction}`",
                "",
                "## Tips",
                "",
                self.ingestion_tips,
                "",
            ]
        )
        return "\n".join(lines)


class CorpusRegistry(BaseModel):
    categories: list[CorpusCategory]

    def by_folder(self, folder: str) -> CorpusCategory | None:
        for cat in self.categories:
            if cat.folder == folder:
                return cat
        return None

    def by_doc_type(self, doc_type: str) -> CorpusCategory | None:
        for cat in self.categories:
            if cat.doc_type == doc_type:
                return cat
        return None


def _default_registry_path() -> Path:
    env = os.environ.get("CORPUS_REGISTRY_PATH")
    if env:
        return Path(env)
    # Repo layout: data/corpus_registry.yaml relative to project root.
    candidates = [
        Path("data/corpus_registry.yaml"),
        Path(__file__).resolve().parents[6] / "data" / "corpus_registry.yaml",
        Path("/app/data/corpus_registry.yaml"),
    ]
    for path in candidates:
        if path.is_file():
            return path
    return candidates[0]


def load_corpus_registry(path: Path | None = None) -> CorpusRegistry:
    registry_path = path or _default_registry_path()
    if not registry_path.is_file():
        return CorpusRegistry(categories=[])
    raw: dict[str, Any]
    with registry_path.open(encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}
    return CorpusRegistry.model_validate(raw)


@lru_cache
def get_corpus_registry() -> CorpusRegistry:
    return load_corpus_registry()
