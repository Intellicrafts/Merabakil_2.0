"""Bar Council of Punjab & Haryana (Punjab, Haryana, Chandigarh) — offline roll index.

BCPH has no working public search, so verification uses the lists it publishes:

* the State Roll PDF ("District/Sub Division/Station wise list of Enrolled
  Advocates", ~134k advocates enrolled up to 2023), and
* the annual bar-association voter lists: "Uploaded" (members on a voter list,
  including recent enrolments) and "Invalid" (BCPH's own record status, e.g.
  Suspended / Dead).

Only what verification needs is kept: enrolment number, name, place of
practice, district, state and status. Mobile numbers, addresses, father's names
and dates of birth in the PDFs are never stored.
"""

from __future__ import annotations

import io
import os
import re
import sqlite3
import tempfile
from dataclasses import dataclass, field
from datetime import datetime, timezone

DEFAULT_INDEX_PATH = os.environ.get("PH_INDEX_PATH", "data/ph_roll.sqlite")

ACTIVE, SUSPENDED, DECEASED, REMOVED, FLAGGED = "active", "suspended", "deceased", "removed", "flagged"

_ENROLMENT_RE = re.compile(r"^(P|PH)/[0-9A-Z()\-]+/\d{4}$")


def normalize_enrollment(raw: str) -> str:
    """Canonical BCPH roll number: "ph-1234-2020" / "PH 1234 2020" / "p/ 5 /1956" → "PH/1234/2020"."""
    s = (raw or "").upper().strip()
    if "/" not in s:
        parts = [p for p in re.split(r"[\s\-]+", s) if p]
        if len(parts) == 3:
            s = "/".join(parts)
    s = re.sub(r"\s*/\s*", "/", s)
    return re.sub(r"\s+", "", s)


def is_bcph_enrollment(raw: str) -> bool:
    return bool(_ENROLMENT_RE.match(normalize_enrollment(raw)))


def _status_of(raw: str) -> str:
    s = (raw or "").strip().lower()
    if not s:
        return ACTIVE
    if "suspend" in s:
        return SUSPENDED
    if "dead" in s or "deceas" in s or "expired" in s:
        return DECEASED
    if any(w in s for w in ("remov", "struck", "cancel")):
        return REMOVED
    return FLAGGED


# ── PDF parsing (column positions come from each page's header row) ─────────

ROLL_COLUMNS = [
    ("sr", "Sr.No"), ("enrollment", "No."), ("name", "Name"), ("address", "Address"),
    ("station", "Station/Place"), ("district", "District"), ("state", "State"),
]
VOTERS_UPLOADED_COLUMNS = [
    ("sr", "Sr.No"), ("name", "Name"), ("father", "FatherName"), ("enrollment", "Enrolment"),
    ("address", "Address"), ("mobile", "MobileNo"), ("aibe", "AIBE"),
]
VOTERS_INVALID_COLUMNS = [
    ("sr", "Sr.No"), ("enrollment", "EnrollmentNo"), ("given_name", "Name"), ("name", "Name"),
    ("status", "Member"),
]

_SERIAL_RE = re.compile(r"^\d{1,6}\.?$")
_PAGE_FOOTER_RE = re.compile(r"^Page \d+ of \d+$", re.IGNORECASE)
# "NAME D/O FATHER" — the relation and father's name are never stored.
# (Some roll entries have no space before it: "RAMANS/O B B MITTAL".)
_RELATION_RE = re.compile(r"\s*(?:[SDWC]\s*/\s*O\b|\b(?:SON|DAUGHTER|WIFE) OF\b).*$", re.IGNORECASE)


def clean_name(name: str) -> str:
    return re.sub(r"\s+", " ", _RELATION_RE.sub("", name or "")).strip()


def _lines(words: list[dict], tolerance: float = 3.0) -> list[list[dict]]:
    lines: list[list[dict]] = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if lines and abs(lines[-1][0]["top"] - w["top"]) <= tolerance:
            lines[-1].append(w)
        else:
            lines.append([w])
    return [sorted(line, key=lambda w: w["x0"]) for line in lines]


def _header_starts(line: list[dict], spec: list[tuple[str, str]]) -> list[tuple[str, float]] | None:
    """Column start positions, matching the spec's header words left to right."""
    starts: list[tuple[str, float]] = []
    i = 0
    for key, label in spec:
        while i < len(line) and not line[i]["text"].lower().startswith(label.lower()):
            i += 1
        if i == len(line):
            return None
        starts.append((key, line[i]["x0"]))
        i += 1
    return starts


def parse_page_rows(words: list[dict], spec: list[tuple[str, str]]) -> list[dict[str, str]]:
    """Rows of one page as {column: text}. A row starts where the serial-number
    column holds a number; following lines without one continue that row."""
    rows: list[dict[str, list[str]]] = []
    starts: list[tuple[str, float]] | None = None
    for line in _lines(words):
        if _PAGE_FOOTER_RE.match(" ".join(w["text"] for w in line)):
            continue
        if starts is None:
            starts = _header_starts(line, spec)
            continue
        cells: dict[str, list[str]] = {}
        for w in line:
            key = starts[0][0]
            for k, x in starts:
                if w["x0"] + 3 >= x:
                    key = k
            cells.setdefault(key, []).append(w["text"])
        serial = " ".join(cells.get("sr", []))
        if _SERIAL_RE.match(serial):
            rows.append(cells)
        elif rows and not serial:
            for k, v in cells.items():
                rows[-1].setdefault(k, []).extend(v)
    return [{k: " ".join(v).strip() for k, v in r.items()} for r in rows]


# ── Index model ──────────────────────────────────────────────────────────────


@dataclass
class Advocate:
    enrollment_no: str
    name: str = ""
    place_of_practice: str = ""
    district: str = ""
    state: str = ""
    status: str = ACTIVE
    status_raw: str = ""
    sources: set[str] = field(default_factory=set)


@dataclass
class BuildStats:
    roll_rows: int = 0
    roll_skipped: int = 0
    voter_rows: int = 0
    voter_new: int = 0
    invalid_rows: int = 0
    pdfs_failed: list[str] = field(default_factory=list)


class IndexBuilder:
    """Merges the roll and the voter lists. The roll's name and place are kept
    when both have an advocate; the Invalid lists' status always wins."""

    def __init__(self) -> None:
        self.advocates: dict[str, Advocate] = {}
        self.stats = BuildStats()

    def add_roll_rows(self, rows: list[dict[str, str]]) -> None:
        for r in rows:
            no = normalize_enrollment(r.get("enrollment", ""))
            if not _ENROLMENT_RE.match(no) or not r.get("name"):
                self.stats.roll_skipped += 1
                continue
            self.stats.roll_rows += 1
            adv = self.advocates.setdefault(no, Advocate(no))
            adv.name = clean_name(r["name"])
            adv.place_of_practice = r.get("station", "")
            adv.district = r.get("district", "")
            adv.state = r.get("state", "").title()
            adv.sources.add("roll")

    def add_voter_rows(self, rows: list[dict[str, str]], bar_association: str) -> None:
        for r in rows:
            no = normalize_enrollment(r.get("enrollment", ""))
            if not _ENROLMENT_RE.match(no):
                continue
            self.stats.voter_rows += 1
            adv = self.advocates.get(no)
            if adv is None:
                self.stats.voter_new += 1
                adv = self.advocates[no] = Advocate(no, name=clean_name(r.get("name", "")))
            if not adv.place_of_practice:
                adv.place_of_practice = bar_association
            adv.sources.add("voters")

    def add_invalid_rows(self, rows: list[dict[str, str]], bar_association: str) -> None:
        for r in rows:
            no = normalize_enrollment(r.get("enrollment", ""))
            if not _ENROLMENT_RE.match(no):
                continue
            self.stats.invalid_rows += 1
            adv = self.advocates.setdefault(no, Advocate(no, place_of_practice=bar_association))
            if not adv.name:
                adv.name = clean_name(r.get("name", ""))  # BCPH's own record name
            adv.status_raw = r.get("status", "")
            adv.status = _status_of(adv.status_raw)
            adv.sources.add("invalid")

    def write(self, path: str, meta: dict[str, str]) -> None:
        """Write to a temp file next to ``path`` and swap it in atomically."""
        directory = os.path.dirname(os.path.abspath(path))
        os.makedirs(directory, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
        os.close(fd)
        try:
            conn = sqlite3.connect(tmp)
            conn.executescript(
                """
                CREATE TABLE advocates (
                    enrollment_no TEXT PRIMARY KEY, name TEXT, place_of_practice TEXT,
                    district TEXT, state TEXT, status TEXT, status_raw TEXT, sources TEXT
                );
                CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
                """
            )
            conn.executemany(
                "INSERT INTO advocates VALUES (?,?,?,?,?,?,?,?)",
                [
                    (a.enrollment_no, a.name, a.place_of_practice, a.district, a.state,
                     a.status, a.status_raw, ",".join(sorted(a.sources)))
                    for a in self.advocates.values()
                ],
            )
            conn.executemany("INSERT INTO meta VALUES (?,?)", list(meta.items()))
            conn.commit()
            conn.close()
            os.chmod(tmp, 0o644)
            os.replace(tmp, path)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)


def parse_pdf(data: bytes, spec: list[tuple[str, str]]) -> list[dict[str, str]]:
    import pdfplumber

    rows: list[dict[str, str]] = []
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        for page in pdf.pages:
            rows.extend(parse_page_rows(page.extract_words(), spec))
            page.flush_cache()
    return rows


def voter_list_links(html: str) -> tuple[list[str], list[str]]:
    """(uploaded, invalid) voter-list PDF URLs from the BCPH voter-lists page."""
    links = sorted(set(re.findall(r'href="([^"]+\.pdf)"', html, flags=re.IGNORECASE)))
    uploaded = [u for u in links if re.search(r"_VoterListUploaded\.pdf$", u, re.IGNORECASE)]
    invalid = [u for u in links if re.search(r"_VoterListInvalid\.pdf$", u, re.IGNORECASE)]
    return uploaded, invalid


def bar_association_of(url: str) -> str:
    name = url.rsplit("/", 1)[-1].split("_VoterList", 1)[0]
    return name.replace("-", " ").replace(".", ". ").replace("  ", " ").strip().title()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ── Lookup ───────────────────────────────────────────────────────────────────


class RollIndex:
    def __init__(self, path: str = DEFAULT_INDEX_PATH) -> None:
        self.path = path

    def available(self) -> bool:
        return os.path.exists(self.path)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(f"file:{self.path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    def lookup(self, enrollment: str) -> dict | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM advocates WHERE enrollment_no = ?", (normalize_enrollment(enrollment),)
            ).fetchone()
        return dict(row) if row else None

    def meta(self) -> dict[str, str]:
        if not self.available():
            return {}
        with self._connect() as conn:
            return {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM meta")}
