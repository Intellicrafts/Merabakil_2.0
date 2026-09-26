"""Section-aware bare-act parsing, exercised on synthetic India Code-style text."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from bare_acts import ACTS, parse_bare_act_text, split_sections  # noqa: E402

_ACT = next(a for a in ACTS if a.key == "bns")
_OLD_CODE = next(a for a in ACTS if a.key == "ipc")

SAMPLE = """THE BHARATIYA NYAYA SANHITA, 2023
ARRANGEMENT OF SECTIONS
1. Short title, commencement and application.
2. Definitions.
3. General explanations.
BE it enacted by Parliament in the Seventy-fourth Year of the Republic of India as follows:—
1. Short title, commencement and application.—(1) This Act may be called the Bharatiya Nyaya Sanhita, 2023.
(2) It shall come into force on such date as the Central Government may appoint.
2. Definitions.—In this Sanhita, unless the context otherwise requires,—
(1) "act" denotes as well a series of acts as a single act;
1. Subs. by Act 12 of 2024, s. 2 (w.e.f. 1-7-2024).
3. General explanations.—Throughout this Sanhita every definition of an offence shall be understood subject to the exceptions.
4A. Punishments.—The punishments to which offenders are liable are death, imprisonment for life and fine.
""" + "5. Long section.—" + ("Words of the long section. " * 150) + """
THE FIRST SCHEDULE
ORDER I
Parties to suits
1. Who may be joined as plaintiffs.—All persons may be joined.
ORDER II
Frame of suit
1. Frame of suit.—Every suit shall be framed so as to afford ground for final decision.
"""


def test_splits_sections_and_skips_index_and_footnotes() -> None:
    sections, schedule = split_sections(SAMPLE)
    numbers = [n for n, _, _ in sections]
    assert numbers == ["1", "2", "3", "4A", "5"]
    assert sections[0][1] == "Short title, commencement and application"
    assert "Subs. by Act" not in [h for _, h, _ in sections]
    assert schedule.startswith("THE FIRST SCHEDULE")


def test_chunks_carry_act_section_citation_and_long_sections_are_split() -> None:
    doc = parse_bare_act_text(SAMPLE, _ACT, source_file="x.pdf", page_count=3)
    first = doc.chunks[0]
    assert first.section == "Section 1"
    assert first.citation == "Section 1, The Bharatiya Nyaya Sanhita, 2023"
    assert first.content.startswith("BNS, Section 1 — Short title")
    assert first.metadata["act"] == "BNS"
    long_parts = [c for c in doc.chunks if c.section == "Section 5"]
    assert len(long_parts) >= 2 and all(len(c.content) < 2600 for c in long_parts)
    orders = {c.section for c in doc.chunks if c.section and c.section.startswith("Order")}
    assert orders == {"Order I", "Order II"}
    assert doc.source_file == "bare-acts/bns.pdf"


def test_replaced_codes_are_labelled_in_every_chunk() -> None:
    doc = parse_bare_act_text(SAMPLE, _OLD_CODE, source_file="x.pdf", page_count=3)
    assert all(c.content.startswith("[Replaced from 1 July 2024") for c in doc.chunks)
