"""Shared hearing blackboard for courtroom agents."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AgendaItem(BaseModel):
    id: str
    label: str
    status: str = "pending"


class ExhibitItem(BaseModel):
    id: str
    title: str
    status: str = "pending"


class AuthorityItem(BaseModel):
    id: str
    title: str
    citation: str = ""
    snippet: str = ""
    source_kind: str = "corpus"
    url: str | None = None
    document_id: str | None = None
    verified: bool = True


class ExtractedFact(BaseModel):
    id: str
    text: str
    side: str = "neutral"  # petitioner | respondent | neutral | court
    status: str = "asserted"  # asserted | admitted | disputed | proved
    source: str = "intake"


class TranscriptTurn(BaseModel):
    role: str
    text: str


class HearingBlackboard(BaseModel):
    matter_title: str
    matter_type: str = "Civil"
    petitioner_name: str = "Petitioner Advocate"
    respondent_name: str = "Respondent Advocate"
    case_summary: str = ""
    facts: str = ""
    issues: str = ""
    relief_sought: str = ""
    agenda: list[AgendaItem] = Field(default_factory=list)
    exhibits: list[ExhibitItem] = Field(default_factory=list)
    authorities: list[AuthorityItem] = Field(default_factory=list)
    transcript_excerpt: str = ""
    transcript_turns: list[TranscriptTurn] = Field(default_factory=list)
    document_ids: list[str] = Field(default_factory=list)
    jurisdiction: str | None = None
    persona_cues: dict[str, str] = Field(default_factory=dict)
    strategy_cues: dict[str, str] = Field(default_factory=dict)
    # Compressed / extracted memory (prompt source of truth after bootstrap)
    compressed_case: str = ""
    extracted_facts: list[ExtractedFact] = Field(default_factory=list)
    running_memory: str = ""
    scratchpads: dict[str, str] = Field(default_factory=dict)
    turn_index: int = 0
    counsel_turns: int = 0
    judge_turns: int = 0
    closings_done: int = 0
    issues_framed: bool = False
    verdict_ready: bool = False
    last_speaker: str | None = None
    derived_phase: str = "appearance"
    force_end: bool = False

    def uncovered(self) -> list[AgendaItem]:
        return [a for a in self.agenda if a.status in {"pending", "raised"}]

    def coverage_pct(self) -> int:
        if not self.agenda:
            return 0
        done = sum(1 for a in self.agenda if a.status in {"contested", "resolved"})
        return round(100 * done / len(self.agenda))

    def snapshot_for_prompt(self) -> str:
        """Debug dump only — agents should use context.pack_for_*."""
        agenda = "\n".join(f"- [{a.id}] ({a.status}) {a.label}" for a in self.agenda) or "(none)"
        facts = "\n".join(
            f"- [{f.id}] ({f.side}/{f.status}) {f.text}" for f in self.extracted_facts
        ) or "(none)"
        return (
            f"Matter: {self.matter_title}\n"
            f"Compressed: {self.compressed_case[:500]}\n"
            f"Memory: {self.running_memory[:300]}\n"
            f"Facts:\n{facts}\n"
            f"Phase: {self.derived_phase} turn={self.turn_index}\n"
            f"Agenda:\n{agenda}\n"
        )

    def apply_agenda_status(self, point_ids: list[str], speaker: str) -> None:
        for item in self.agenda:
            if item.id not in point_ids:
                continue
            if speaker == "judge":
                if item.status == "pending":
                    item.status = "raised"
            elif item.status == "pending":
                item.status = "raised"
            elif item.status == "raised":
                item.status = "contested"

    def apply_exhibit_status(self, exhibit_id: str, status: str) -> ExhibitItem | None:
        for ex in self.exhibits:
            if ex.id == exhibit_id:
                ex.status = status
                return ex
        return None

    def upsert_authority(self, auth: AuthorityItem) -> None:
        if any(a.id == auth.id or a.title == auth.title for a in self.authorities):
            return
        self.authorities.append(auth)

    def derive_phase(self) -> str:
        if self.verdict_ready or self.force_end:
            return "verdict"
        if self.closings_done >= 2:
            return "verdict"
        if self.closings_done > 0 or (
            self.coverage_pct() >= 85 and self.counsel_turns >= 6
        ):
            return "closing"
        if self.issues_framed and self.exhibits and any(
            e.status == "pending" for e in self.exhibits
        ) and self.counsel_turns < 2:
            return "evidence_marking"
        if not self.issues_framed:
            return "issues_framed"
        if self.counsel_turns >= 4 and self.coverage_pct() >= 70:
            return "reply"
        return "submissions"

    def refresh_phase(self) -> None:
        self.derived_phase = self.derive_phase()


def blackboard_from_payload(data: dict[str, Any]) -> HearingBlackboard:
    agenda = [
        AgendaItem(id=a["id"], label=a["label"], status=a.get("status", "pending"))
        for a in (data.get("agenda") or [])
    ]
    exhibits = [
        ExhibitItem(id=e["id"], title=e["title"], status=e.get("status", "pending"))
        for e in (data.get("exhibits") or [])
    ]
    authorities = [
        AuthorityItem(
            id=a.get("id") or f"a{i}",
            title=a.get("title") or "",
            citation=a.get("citation") or "",
            snippet=a.get("snippet") or "",
            source_kind=a.get("sourceKind") or a.get("source_kind") or "corpus",
            url=a.get("url"),
            document_id=a.get("documentId") or a.get("document_id"),
            verified=a.get("verified", True),
        )
        for i, a in enumerate(data.get("authorities") or [])
    ]
    extracted = []
    for i, f in enumerate(data.get("extracted_facts") or data.get("extractedFacts") or []):
        if not isinstance(f, dict):
            continue
        text = str(f.get("text") or "").strip()
        if not text:
            continue
        extracted.append(
            ExtractedFact(
                id=str(f.get("id") or f"f{i + 1}"),
                text=text,
                side=str(f.get("side") or "neutral"),
                status=str(f.get("status") or "asserted"),
                source=str(f.get("source") or "intake"),
            )
        )
    turns = []
    for t in data.get("transcript_turns") or data.get("transcriptTurns") or []:
        if isinstance(t, dict) and t.get("role") and t.get("text"):
            turns.append(TranscriptTurn(role=str(t["role"]), text=str(t["text"])))
    scratch = data.get("scratchpads") or data.get("scratchPads") or {}
    if not isinstance(scratch, dict):
        scratch = {}

    return HearingBlackboard(
        matter_title=data.get("matter_title") or data.get("matterTitle") or "Matter",
        matter_type=data.get("matter_type") or data.get("matterType") or "Civil",
        petitioner_name=data.get("petitioner_name") or data.get("petitionerName") or "Petitioner",
        respondent_name=data.get("respondent_name") or data.get("respondentName") or "Respondent",
        case_summary=data.get("case_summary") or data.get("caseSummary") or "",
        facts=data.get("facts") or "",
        issues=data.get("issues") or "",
        relief_sought=data.get("relief_sought") or data.get("reliefSought") or "",
        agenda=agenda,
        exhibits=exhibits,
        authorities=authorities,
        transcript_excerpt=data.get("transcript_excerpt") or data.get("transcriptExcerpt") or "",
        transcript_turns=turns,
        document_ids=list(data.get("document_ids") or data.get("documentIds") or []),
        jurisdiction=data.get("jurisdiction"),
        persona_cues=dict(data.get("persona_cues") or data.get("personaCues") or {}),
        strategy_cues=dict(data.get("strategy_cues") or data.get("strategyCues") or {}),
        compressed_case=data.get("compressed_case") or data.get("compressedCase") or "",
        extracted_facts=extracted,
        running_memory=data.get("running_memory") or data.get("runningMemory") or "",
        scratchpads={str(k): str(v) for k, v in scratch.items()},
        turn_index=int(data.get("turn_index") or data.get("turnIndex") or 0),
        counsel_turns=int(data.get("counsel_turns") or data.get("counselTurns") or 0),
        judge_turns=int(data.get("judge_turns") or data.get("judgeTurns") or 0),
        closings_done=int(data.get("closings_done") or data.get("closingsDone") or 0),
        issues_framed=bool(data.get("issues_framed") or data.get("issuesFramed") or False),
        verdict_ready=bool(data.get("verdict_ready") or data.get("verdictReady") or False),
        last_speaker=data.get("last_speaker") or data.get("lastSpeaker"),
        derived_phase=data.get("derived_phase") or data.get("derivedPhase") or "appearance",
        force_end=bool(data.get("force_end") or data.get("forceEnd") or False),
    )
