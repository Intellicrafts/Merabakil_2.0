"""Core Indian bare acts for Saarthi's knowledge base — manifest + section-aware parser.

The PDFs are not committed. Download each ``source_url`` into
``raw-data/bare-acts/<key>.pdf`` (see raw-data/bare-acts/README.md), then run
``build_statute_corpus.py``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from parsers.types import ParsedChunk, ParsedDocument

IN_FORCE = "in_force"
REPLACED_2024 = "replaced_2024"  # IPC / CrPC / Evidence Act — still govern pre-1 July 2024 matters


@dataclass(frozen=True, slots=True)
class BareAct:
    key: str
    title: str
    short: str
    act_no: str
    status: str
    source_url: str
    doc_type: str = "statute"

    @property
    def filename(self) -> str:
        return f"{self.key}.pdf"


ACTS: tuple[BareAct, ...] = (
    BareAct("bns", "The Bharatiya Nyaya Sanhita, 2023", "BNS", "Act 45 of 2023", IN_FORCE,
            "https://www.ncrb.gov.in/uploads/SankalanPortal/DownloadPDF/BNS2023.pdf"),
    BareAct("bnss", "The Bharatiya Nagarik Suraksha Sanhita, 2023", "BNSS", "Act 46 of 2023", IN_FORCE,
            "https://www.ncrb.gov.in/uploads/SankalanPortal/DownloadPDF/BNSS2023.pdf"),
    BareAct("bsa", "The Bharatiya Sakshya Adhiniyam, 2023", "BSA", "Act 47 of 2023", IN_FORCE,
            "https://www.ncrb.gov.in/uploads/SankalanPortal/DownloadPDF/BSA2023.pdf"),
    BareAct("ipc", "The Indian Penal Code, 1860", "IPC", "Act 45 of 1860", REPLACED_2024,
            "https://www.indiacode.nic.in/bitstream/123456789/2263/1/A1860-45.pdf"),
    BareAct("crpc", "The Code of Criminal Procedure, 1973", "CrPC", "Act 2 of 1974", REPLACED_2024,
            "https://www.indiacode.nic.in/bitstream/123456789/16225/1/A1974-02.pdf"),
    BareAct("iea", "The Indian Evidence Act, 1872", "Evidence Act", "Act 1 of 1872", REPLACED_2024,
            "https://www.indiacode.nic.in/bitstream/123456789/2188/1/A1872-1.pdf"),
    BareAct("cpc", "The Code of Civil Procedure, 1908", "CPC", "Act 5 of 1908", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/2191/1/A1908-05.pdf"),
    BareAct("contract", "The Indian Contract Act, 1872", "Contract Act", "Act 9 of 1872", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/2187/2/A187209.pdf"),
    BareAct("sra", "The Specific Relief Act, 1963", "Specific Relief Act", "Act 47 of 1963", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/1583/7/A1963-47.pdf"),
    BareAct("limitation", "The Limitation Act, 1963", "Limitation Act", "Act 36 of 1963", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/1565/5/A1963-36.pdf"),
    BareAct("tpa", "The Transfer of Property Act, 1882", "TPA", "Act 4 of 1882", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/2338/1/A1882-04.pdf"),
    BareAct("cpa", "The Consumer Protection Act, 2019", "Consumer Protection Act", "Act 35 of 2019", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/16939/1/a2019-35.pdf"),
    BareAct("dv", "The Protection of Women from Domestic Violence Act, 2005", "DV Act", "Act 43 of 2005", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/2021/5/A2005-43.pdf"),
    BareAct("pocso", "The Protection of Children from Sexual Offences Act, 2012", "POCSO Act", "Act 32 of 2012",
            IN_FORCE, "https://www.indiacode.nic.in/bitstream/123456789/9318/1/sexualoffencea2012-32.pdf"),
    BareAct("hma", "The Hindu Marriage Act, 1955", "Hindu Marriage Act", "Act 25 of 1955", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/1560/1/A1955-25.pdf"),
    BareAct("sma", "The Special Marriage Act, 1954", "Special Marriage Act", "Act 43 of 1954", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/1387/1/A195443.pdf"),
    BareAct("hsa", "The Hindu Succession Act, 1956", "Hindu Succession Act", "Act 30 of 1956", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/1713/1/A1956-30.pdf"),
    BareAct("ni", "The Negotiable Instruments Act, 1881", "NI Act", "Act 26 of 1881", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/2189/1/A1881-26.pdf"),
    BareAct("rti", "The Right to Information Act, 2005", "RTI Act", "Act 22 of 2005", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/2065/1/A2005-22.pdf"),
    BareAct("it", "The Information Technology Act, 2000", "IT Act", "Act 21 of 2000", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/1999/3/A2000-21.pdf"),
    BareAct("mv", "The Motor Vehicles Act, 1988", "MV Act", "Act 59 of 1988", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/1798/1/aA1988-59.pdf"),
    BareAct("rera", "The Real Estate (Regulation and Development) Act, 2016", "RERA", "Act 16 of 2016", IN_FORCE,
            "https://www.indiacode.nic.in/bitstream/123456789/2158/3/A2016-16.pdf"),
)

_STATUS_NOTE = {
    REPLACED_2024: "[Replaced from 1 July 2024 by the new criminal codes; still applies to offences "
    "and proceedings from before that date.] ",
    IN_FORCE: "",
}

# A section starts a line: "12. Heading.—" / "12A. Heading.–"
_SECTION_START = re.compile(r"(?m)^[ \t]*(\d{1,3})([A-Z]{0,3})\.[ \t]+(?=\S)")
_HEADING_END = re.compile(r"\.\s*[—–-]{1,2}")
# Footnotes also look like "3. Subs. by Act 12 of 2019…" — never a section.
_FOOTNOTE = re.compile(
    r"^(?:Subs|Ins|Omitted|Rep|The words|Added|Now see|See|Vide|Cl\.|Clause|Sub-section|"
    r"Came into force|w\.e\.f|Proviso|Explanation|Section|Ss?\.|Renumbered|Inserted|Substituted)\b",
    re.IGNORECASE,
)
_BODY_START = re.compile(r"BE\s+it\s+enacted|ENACTED\s+by\s+Parliament", re.IGNORECASE)
_SCHEDULE_START = re.compile(r"(?m)^\s*THE\s+(?:FIRST\s+)?SCHEDULE\b")
_ORDER_START = re.compile(r"(?m)^\s*ORDER\s+([IVXL]+[A-Z]?)\b")
_MAX_CHUNK = 2400
_PART_SIZE = 2000
_OVERLAP = 150


def _clean(text: str) -> str:
    text = text.replace(" ", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _parts(body: str) -> list[str]:
    if len(body) <= _MAX_CHUNK:
        return [body]
    parts: list[str] = []
    start = 0
    while start < len(body):
        end = min(len(body), start + _PART_SIZE)
        if end < len(body):  # prefer to break on a paragraph or sentence
            cut = max(body.rfind("\n", start + _PART_SIZE // 2, end), body.rfind(". ", start + _PART_SIZE // 2, end))
            if cut > start:
                end = cut + 1
        parts.append(body[start:end].strip())
        if end >= len(body):
            break
        start = max(end - _OVERLAP, start + 1)
    return [p for p in parts if p]


def split_sections(text: str) -> tuple[list[tuple[str, str, str]], str]:
    """Split bare-act text into (number, heading, body) sections, plus any trailing
    schedule text. Skips the arrangement-of-sections index and page footnotes."""
    body_match = _BODY_START.search(text)
    body = text[body_match.end():] if body_match else text

    schedule = ""
    sched = _SCHEDULE_START.search(body)
    starts: list[tuple[int, str, str]] = []
    last = 0
    for m in _SECTION_START.finditer(body):
        if sched and m.start() >= sched.start():
            break
        num = int(m.group(1))
        rest = body[m.end(): m.end() + 200]
        if _FOOTNOTE.match(rest):
            continue
        if not (num == last or last < num <= last + 6) or (last == 0 and num != 1):
            continue
        heading_match = _HEADING_END.search(rest)
        heading = rest[: heading_match.start()] if heading_match else rest.split(".")[0]
        heading = " ".join(heading.split())[:160]
        starts.append((m.start(), f"{m.group(1)}{m.group(2)}", heading))
        last = num

    sections: list[tuple[str, str, str]] = []
    for i, (pos, number, heading) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else (sched.start() if sched else len(body))
        sections.append((number, heading, body[pos:end].strip()))
    if sched and starts:
        schedule = body[sched.start():].strip()
    return sections, schedule


def _schedule_chunks(act: BareAct, schedule: str) -> list[ParsedChunk]:
    orders = list(_ORDER_START.finditer(schedule))
    blocks: list[tuple[str, str]] = []
    if orders:
        for i, m in enumerate(orders):
            end = orders[i + 1].start() if i + 1 < len(orders) else len(schedule)
            blocks.append((f"Order {m.group(1)}", schedule[m.start():end]))
    else:
        blocks.append(("Schedule", schedule))
    chunks: list[ParsedChunk] = []
    for label, text in blocks:
        for n, part in enumerate(_parts(text.strip()), 1):
            chunks.append(
                ParsedChunk(
                    content=f"{_STATUS_NOTE[act.status]}{act.short} — {label}\n{part}",
                    title=f"{act.title} — {label}" + (f" (part {n})" if n > 1 else ""),
                    section=label,
                    citation=f"{label}, {act.title}",
                    metadata={"act": act.short, "act_status": act.status, "source_url": act.source_url},
                )
            )
    return chunks


def parse_bare_act_text(text: str, act: BareAct, *, source_file: str, page_count: int | None) -> ParsedDocument:
    sections, schedule = split_sections(_clean(text))
    chunks: list[ParsedChunk] = []
    for number, heading, body in sections:
        pieces = _parts(body)
        for n, piece in enumerate(pieces, 1):
            label = f"Section {number}"
            chunks.append(
                ParsedChunk(
                    content=f"{_STATUS_NOTE[act.status]}{act.short}, {label} — {heading}\n{piece}",
                    title=f"{act.title} — {label}: {heading}" + (f" (part {n})" if len(pieces) > 1 else ""),
                    section=label,
                    citation=f"{label}, {act.title}",
                    metadata={
                        "act": act.short,
                        "act_status": act.status,
                        "section_number": number,
                        "source_url": act.source_url,
                    },
                )
            )
    if schedule:
        chunks.extend(_schedule_chunks(act, schedule))
    return ParsedDocument(
        title=act.title,
        doc_type=act.doc_type,
        jurisdiction="india",
        chunks=chunks,
        source_file=f"bare-acts/{act.filename}",
        content_hash=ParsedDocument.hash_content("".join(c.content for c in chunks)),
        page_count=page_count,
        citations=[act.act_no],
    )


def parse_bare_act_pdf(path: Path, act: BareAct) -> ParsedDocument:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    return parse_bare_act_text(text, act, source_file=str(path), page_count=len(reader.pages))
