import type {
  AgentPersona,
  CaseIntakeBundle,
  CourtroomRunRecord,
  CourtroomSessionConfig,
  CourtroomSessionSnapshot,
  Exhibit,
  HearingAgendaItem,
  JudgmentReport,
  ProposedActionPlan,
  TranscriptEntry,
} from "@/lib/courtroom/types";

export const COURTROOM_SESSION_KEY = "legalos.courtroom.lastSession";
export const COURTROOM_RUNS_KEY = "legalos.courtroom.runs";
export const COURTROOM_CHECKLIST_KEY = "legalos.courtroom.actionChecklist";
export const MERA_VAKIL_PREFILL_KEY = "legalos.meravakil.prefill";
export const RESEARCH_PREFILL_KEY = "legalos.research.prefill";

const MAX_RUNS = 20;
const MAX_TRANSCRIPT_TURNS = 80;
const MAX_TRANSCRIPT_CHARS = 40_000;

export function saveCourtroomSessionSnapshot(snapshot: CourtroomSessionSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COURTROOM_SESSION_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore quota */
  }
}

export function loadCourtroomSessionSnapshot(): CourtroomSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COURTROOM_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CourtroomSessionSnapshot;
  } catch {
    return null;
  }
}

export function saveActionChecklist(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COURTROOM_CHECKLIST_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function loadActionChecklist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COURTROOM_CHECKLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function readRunsRaw(): CourtroomRunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COURTROOM_RUNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CourtroomRunRecord[]) : [];
  } catch {
    return [];
  }
}

function writeRuns(runs: CourtroomRunRecord[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(COURTROOM_RUNS_KEY, JSON.stringify(runs));
    return true;
  } catch {
    return false;
  }
}

export function listCourtroomRuns(): CourtroomRunRecord[] {
  return readRunsRaw().sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
}

export function getCourtroomRun(id: string): CourtroomRunRecord | null {
  return readRunsRaw().find((r) => r.id === id) ?? null;
}

export function deleteCourtroomRun(id: string): void {
  const next = readRunsRaw().filter((r) => r.id !== id);
  writeRuns(next);
}

/** Strip blob URLs / non-serializable preview fields from intake artifacts. */
export function sanitizeIntakeForStorage(intake: CaseIntakeBundle | null | undefined): CaseIntakeBundle | null {
  if (!intake) return null;
  return {
    ...intake,
    artifacts: (intake.artifacts ?? []).map((a) => ({
      id: a.id,
      kind: a.kind,
      name: a.name,
      sizeBytes: a.sizeBytes,
      documentId: a.documentId,
      status: a.status,
      excerpt: a.excerpt,
    })),
  };
}

export function truncateTranscript(entries: TranscriptEntry[]): TranscriptEntry[] {
  const sliced = entries.slice(-MAX_TRANSCRIPT_TURNS);
  let total = 0;
  const out: TranscriptEntry[] = [];
  for (let i = sliced.length - 1; i >= 0; i -= 1) {
    const e = sliced[i]!;
    const len = (e.text?.length ?? 0) + (e.textHi?.length ?? 0);
    if (total + len > MAX_TRANSCRIPT_CHARS && out.length > 0) break;
    total += len;
    out.unshift(e);
  }
  return out;
}

export function buildCourtroomRunRecord(opts: {
  id: string;
  config: CourtroomSessionConfig;
  exhibits: Exhibit[];
  intake: CaseIntakeBundle | null;
  agents: AgentPersona[];
  judgment: JudgmentReport;
  actionPlan: ProposedActionPlan | null;
  checkedActionIds: string[];
  transcript: TranscriptEntry[];
  agenda?: HearingAgendaItem[];
}): CourtroomRunRecord {
  return {
    id: opts.id,
    savedAt: new Date().toISOString(),
    config: {
      matterTitle: opts.config.matterTitle,
      matterType: opts.config.matterType,
      petitionerName: opts.config.petitionerName,
      respondentName: opts.config.respondentName,
      presetId: opts.config.presetId,
    },
    exhibits: opts.exhibits,
    intake: sanitizeIntakeForStorage(opts.intake),
    agents: opts.agents,
    judgment: opts.judgment,
    actionPlan: opts.actionPlan,
    checkedActionIds: opts.checkedActionIds,
    transcript: truncateTranscript(opts.transcript),
    agenda: opts.agenda,
  };
}

/**
 * Insert or replace a run by id. Newest first. Caps at MAX_RUNS.
 * Also mirrors into lastSession for backward compatibility.
 * On quota failure, drops oldest runs and retries once.
 */
export function upsertCourtroomRun(record: CourtroomRunRecord): CourtroomRunRecord[] {
  let runs = readRunsRaw().filter((r) => r.id !== record.id);
  runs.unshift(record);
  if (runs.length > MAX_RUNS) runs = runs.slice(0, MAX_RUNS);

  if (!writeRuns(runs)) {
    runs = runs.slice(0, Math.max(1, Math.floor(runs.length / 2)));
    writeRuns(runs);
  }

  saveCourtroomSessionSnapshot({
    savedAt: record.savedAt,
    config: {
      matterTitle: record.config.matterTitle,
      matterType: record.config.matterType,
      petitionerName: record.config.petitionerName,
      respondentName: record.config.respondentName,
    },
    judgment: record.judgment,
    actionPlan: record.actionPlan,
    checkedActionIds: record.checkedActionIds,
  });

  return runs;
}

export function buildActionsPayload(opts: {
  config: CourtroomSessionConfig;
  judgment: JudgmentReport;
  agenda?: { id: string; label: string; status: string }[];
  transcriptText: string;
}) {
  const { config, judgment, agenda, transcriptText } = opts;
  const verifiedCiteCount = judgment.authoritiesQuality?.verifiedCount ??
    judgment.authorities?.filter((a) => a.verified).length ??
    0;
  const unverifiedCiteCount = judgment.authoritiesQuality?.unverifiedCount ??
    judgment.authorities?.filter((a) => !a.verified).length ??
    0;
  return {
    matter_title: config.matterTitle,
    matter_type: config.matterType,
    petitioner_name: config.petitionerName,
    respondent_name: config.respondentName,
    oral_verdict: judgment.oralVerdict ?? null,
    disposition: judgment.disposition ?? null,
    issues_framed: judgment.issuesFramed ?? [],
    weaknesses_exposed: judgment.weaknessesExposed ?? [],
    coverage_summary: judgment.coverageSummary ?? null,
    agenda: (agenda ?? []).map((a) => ({
      id: a.id,
      label: a.label,
      status: a.status,
    })),
    transcript_excerpt: transcriptText.slice(-6000),
    notCovered: judgment.notCovered ?? [],
    verifiedCiteCount,
    unverifiedCiteCount,
  };
}

export function snapshotFromState(opts: {
  config: CourtroomSessionConfig;
  judgment: JudgmentReport;
  actionPlan: ProposedActionPlan | null;
  checkedActionIds: string[];
}): CourtroomSessionSnapshot {
  return {
    savedAt: new Date().toISOString(),
    config: {
      matterTitle: opts.config.matterTitle,
      matterType: opts.config.matterType,
      petitionerName: opts.config.petitionerName,
      respondentName: opts.config.respondentName,
    },
    judgment: opts.judgment,
    actionPlan: opts.actionPlan,
    checkedActionIds: opts.checkedActionIds,
  };
}

export function setResearchPrefill(query: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RESEARCH_PREFILL_KEY, query);
}

export function consumeResearchPrefill(): string | null {
  if (typeof window === "undefined") return null;
  const q = sessionStorage.getItem(RESEARCH_PREFILL_KEY);
  if (q) sessionStorage.removeItem(RESEARCH_PREFILL_KEY);
  return q;
}

export function setMeraVakilPrefill(query: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MERA_VAKIL_PREFILL_KEY, query);
}

export function consumeMeraVakilPrefill(): string | null {
  if (typeof window === "undefined") return null;
  const q = sessionStorage.getItem(MERA_VAKIL_PREFILL_KEY);
  if (q) sessionStorage.removeItem(MERA_VAKIL_PREFILL_KEY);
  return q;
}
