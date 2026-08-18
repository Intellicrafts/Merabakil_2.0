import { runCourtroomAgentTurn, streamResearch } from "@/lib/api";
import type { CourtroomAgentTurnResponse } from "@/lib/api";
import type { CourtroomSimulationAdapter } from "@/lib/courtroom/adapter";
import {
  authoritiesQuality,
  deriveHearingMetrics,
} from "@/lib/courtroom/confidence";
import {
  buildCoverageAgenda,
  coveragePercent,
  markAgendaPoints,
  notCoveredPoints,
  uncoveredPoints,
} from "@/lib/courtroom/hearing-agenda";
import {
  buildJudgmentPrompt,
  parseJudgmentJson,
} from "@/lib/courtroom/hearing-prompts";
import { getDemoPreset } from "@/lib/courtroom/demo-sessions";
import { toHindiCompanion } from "@/lib/courtroom/bilingual";
import type {
  AuthoritySourceKind,
  CourtroomEvent,
  CourtroomListener,
  CourtroomSessionConfig,
  CourtroomState,
  Exhibit,
  ExhibitStatus,
  HearingAgendaItem,
  HearingTimelineStep,
  HearingTurn,
  JudgmentReport,
  LegalAuthority,
  ObjectionType,
  SpeakerRole,
  TranscriptEntry,
} from "@/lib/courtroom/types";

const MAX_TURNS = 28;
const UNGATED_DELAY_MS = 400;

type HearingPhase =
  | "appearance"
  | "issues_framed"
  | "evidence_marking"
  | "submissions"
  | "reply"
  | "closing"
  | "verdict"
  | "deliberation";

function initialState(): CourtroomState {
  return {
    phase: "setup",
    activeSpeaker: null,
    judgeState: "listening",
    timelineStep: "appearance",
    transcript: [],
    exhibits: [],
    authorities: [],
    objections: [],
    metrics: {
      argumentStrength: 0.35,
      evidenceSupport: 0.3,
      proceduralCompliance: 0.7,
    },
    elapsedSeconds: 0,
    isPaused: false,
    judgment: null,
    isThinking: false,
    agenda: [],
  };
}

function speakerName(config: CourtroomSessionConfig, role: SpeakerRole): string {
  if (role === "judge") return "Hon'ble AI Judge";
  if (role === "clerk") return "Court Clerk";
  if (role === "petitioner") return config.petitionerName;
  return config.respondentName;
}

function intakeDocumentIds(config: CourtroomSessionConfig): string[] {
  return (config.intake?.artifacts ?? [])
    .map((a) => a.documentId)
    .filter((id): id is string => Boolean(id));
}

function mapVerifiedSource(
  src: {
    id: string;
    title: string;
    citation: string;
    snippet?: string;
    sourceKind: AuthoritySourceKind;
    url?: string | null;
    documentId?: string | null;
    verified: boolean;
  },
  marker: string,
  citedBy?: SpeakerRole,
): LegalAuthority {
  return {
    id: src.id,
    marker,
    title: src.title,
    citation: src.citation || src.title,
    citedBy,
    verified: src.verified !== false,
    sourceKind: src.sourceKind,
    url: src.url ?? undefined,
    snippet: src.snippet,
    documentId: src.documentId ?? undefined,
  };
}

function fallbackTurn(
  role: SpeakerRole,
  config: CourtroomSessionConfig,
  agenda: HearingAgendaItem[],
  phase: HearingPhase,
): HearingTurn {
  const open = uncoveredPoints(agenda)[0];
  const pointIds = open ? [open.id] : [];
  if (role === "judge") {
    if (phase === "issues_framed") {
      const text = `Issues are framed for consideration: ${agenda
        .slice(0, 4)
        .map((a) => a.label)
        .join("; ") || "as arising from the pleadings"}. Counsel shall confine arguments to these issues and the prayer.`;
      return {
        speaker: "judge",
        text,
        textHi: toHindiCompanion(text),
        addressesPointIds: agenda.slice(0, 3).map((a) => a.id),
        timelineStep: "issues_framed",
        judgeState: "questioning",
        judgeNote: "Issues framed",
      };
    }
    return {
      speaker: "judge",
      text: open
        ? `Counsel, confine yourselves to the record. Address specifically: ${open.label}`
        : "The Court has noted the submissions. Proceed.",
      textHi: toHindiCompanion(
        open
          ? `अधिवक्तागण, रिकॉर्ड तक सीमित रहें। विशेष रूप से संबोधित करें: ${open.label}`
          : "न्यायालय ने निवेदन नोट किए।",
      ),
      addressesPointIds: pointIds,
      timelineStep: phase,
      judgeState: "questioning",
      judgeNote: "Testing the record",
    };
  }
  const text =
    role === "petitioner"
      ? `My Lords, the petitioner relies on the pleaded facts${open ? ` — particularly ${open.label}` : ""}. The record supports interim and final relief as prayed.`
      : `My Lords, the respondent contests that narrative${open ? ` as to ${open.label}` : ""}. The petitioner has not discharged the burden on the present record.`;
  return {
    speaker: role,
    text,
    textHi: toHindiCompanion(text),
    addressesPointIds: pointIds,
    timelineStep: phase === "reply" ? "reply" : "submissions",
  };
}

export function createLlmCourtroomAdapter(): CourtroomSimulationAdapter {
  let state = initialState();
  const listeners = new Set<CourtroomListener>();
  let config: CourtroomSessionConfig | null = null;
  let agenda: HearingAgendaItem[] = [];
  let turnIndex = 0;
  let speechGated = true;
  let awaitingSpeech = false;
  let hearingPhase: HearingPhase = "appearance";
  let closingsDone = 0;
  let counselTurns = 0;
  let judgeTurns = 0;
  let issuesFramed = false;
  let verdictDelivered = false;
  let oralVerdictText = "";
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let abortController: AbortController | null = null;
  let generating = false;
  let disposed = false;
  let lastSpeaker: SpeakerRole | null = null;
  let prefetchPromise: Promise<CourtroomAgentTurnResponse> | null = null;
  let prefetchController: AbortController | null = null;
  let compressedCase = "";
  let extractedFacts: {
    id: string;
    text: string;
    side?: string;
    status?: string;
    source?: string;
  }[] = [];
  let runningMemory = "";
  let scratchpads: Record<string, string> = {};
  let transcriptTurns: { role: string; text: string }[] = [];

  const emit = (event: CourtroomEvent) => {
    listeners.forEach((l) => l(event));
  };

  const setThinking = (active: boolean) => {
    state = { ...state, isThinking: active };
    emit({ type: "thinking", active });
  };

  const refreshDerivedMetrics = () => {
    const { metrics, methodology } = deriveHearingMetrics({
      agenda,
      authorities: state.authorities,
      exhibits: state.exhibits,
      objections: state.objections,
    });
    state = { ...state, metrics, confidenceMethodology: methodology };
    emit({ type: "metricsUpdate", metrics, methodology });
  };

  const emitCoverage = () => {
    state = { ...state, agenda: [...agenda] };
    emit({ type: "coverageUpdate", agenda: [...agenda] });
  };

  const setPhaseLabel = (phase: HearingPhase) => {
    hearingPhase = phase;
    const step = phase as HearingTimelineStep;
    state = { ...state, timelineStep: step };
    emit({ type: "timelineStep", step });
  };

  const addTranscript = (role: SpeakerRole, text: string, textHi?: string) => {
    if (!config) return;
    const entry: TranscriptEntry = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      speaker: speakerName(config, role),
      role,
      text,
      textHi: textHi ?? toHindiCompanion(text),
      timestamp: state.elapsedSeconds,
    };
    state = { ...state, transcript: [...state.transcript, entry], activeSpeaker: role };
    emit({ type: "speakerChange", role });
    emit({ type: "transcript", entry });
    lastSpeaker = role;
  };

  const applyExhibitActions = (actions?: { exhibitId: string; status: ExhibitStatus }[]) => {
    if (!actions?.length) return;
    let exhibits = [...state.exhibits];
    for (const action of actions) {
      const idx = exhibits.findIndex((e) => e.id === action.exhibitId);
      if (idx < 0) continue;
      const updated = { ...exhibits[idx], status: action.status };
      exhibits = [...exhibits.slice(0, idx), updated, ...exhibits.slice(idx + 1)];
      emit({ type: "exhibitUpdate", exhibit: updated });
    }
    state = { ...state, exhibits };
  };

  const applyTurn = (turn: HearingTurn, opts?: { isVerdict?: boolean }) => {
    if (!config) return;
    const role = turn.speaker === "clerk" ? "petitioner" : turn.speaker;
    if (turn.timelineStep) {
      state = { ...state, timelineStep: turn.timelineStep };
      emit({ type: "timelineStep", step: turn.timelineStep });
      if (
        turn.timelineStep === "issues_framed" ||
        turn.timelineStep === "submissions" ||
        turn.timelineStep === "reply" ||
        turn.timelineStep === "closing" ||
        turn.timelineStep === "verdict" ||
        turn.timelineStep === "evidence_marking" ||
        turn.timelineStep === "appearance"
      ) {
        hearingPhase = turn.timelineStep as HearingPhase;
      }
    }
    if (role === "judge" && (turn.judgeState || turn.judgeNote)) {
      state = {
        ...state,
        judgeState: turn.judgeState ?? "questioning",
        judgeNote: turn.judgeNote,
      };
      emit({
        type: "judgeState",
        state: turn.judgeState ?? "questioning",
        note: turn.judgeNote,
      });
    }

    agenda = markAgendaPoints(agenda, turn.addressesPointIds, role);
    emitCoverage();

    if (turn.verifiedSources?.length) {
      const citeIds = new Set(turn.verifiedCiteIds ?? turn.verifiedSources.map((s) => s.id));
      turn.verifiedSources.forEach((src) => {
        if (!citeIds.has(src.id) && turn.verifiedCiteIds?.length) return;
        if (state.authorities.some((a) => a.id === src.id || a.title === src.title)) return;
        const authority = mapVerifiedSource(
          {
            id: src.id,
            title: src.title,
            citation: src.citation,
            snippet: src.snippet,
            sourceKind: src.sourceKind ?? "corpus",
            url: src.url,
            documentId: src.documentId,
            verified: src.verified !== false,
          },
          `V${state.authorities.filter((a) => a.verified).length + 1}`,
          role === "clerk" ? undefined : role,
        );
        state = { ...state, authorities: [...state.authorities, authority] };
        emit({ type: "authorityCited", authority });
      });
    }

    applyExhibitActions(turn.exhibitActions);
    refreshDerivedMetrics();
    addTranscript(role, turn.text, turn.textHi);
    turnIndex += 1;
    if (role === "judge") judgeTurns += 1;
    else if (role === "petitioner" || role === "respondent") counselTurns += 1;
    if (hearingPhase === "closing" && (role === "petitioner" || role === "respondent")) {
      closingsDone += 1;
    }
    if (opts?.isVerdict || turn.timelineStep === "verdict") {
      verdictDelivered = true;
      oralVerdictText = turn.text;
    }
    if (speechGated) awaitingSpeech = true;
  };

  const buildAgentPayload = (opts?: {
    forceEnd?: boolean;
    forceSpeaker?: "judge" | "petitioner" | "respondent" | null;
  }) => {
    const personaCues: Record<string, string> = {};
    const strategyCues: Record<string, string> = {};
    config!.agents?.forEach((a) => {
      const key =
        a.role === "judge" ? "judge" : a.role === "petitioner_advocate" ? "petitioner" : "respondent";
      personaCues[key] = a.tone;
      strategyCues[key] = a.strategy.slice(0, 3).join("; ");
    });
    return {
      matter_title: config!.matterTitle,
      matter_type: config!.matterType,
      petitioner_name: config!.petitionerName,
      respondent_name: config!.respondentName,
      case_summary: config!.intake?.summary,
      facts: config!.intake?.facts,
      issues: config!.intake?.issues,
      relief_sought: config!.intake?.reliefSought,
      agenda: agenda.map((a) => ({ id: a.id, label: a.label, status: a.status })),
      exhibits: state.exhibits.map((e) => ({
        id: e.id,
        title: e.title,
        status: e.status,
      })),
      authorities: state.authorities.map((a) => ({
        id: a.id,
        title: a.title,
        citation: a.citation,
        snippet: a.snippet,
        sourceKind: a.sourceKind,
        url: a.url,
        documentId: a.documentId,
        verified: a.verified,
      })),
      transcript_excerpt: state.transcript
        .slice(-10)
        .map((t) => `${t.speaker} (${t.role}): ${t.text}`)
        .join("\n"),
      transcriptTurns:
        transcriptTurns.length > 0
          ? transcriptTurns.slice(-12)
          : state.transcript.slice(-12).map((t) => ({
              role: t.role,
              text: t.text,
            })),
      document_ids: intakeDocumentIds(config!),
      personaCues,
      strategyCues,
      compressedCase: compressedCase || null,
      extractedFacts,
      runningMemory: runningMemory || null,
      scratchpads,
      turnIndex,
      counselTurns,
      judgeTurns,
      closingsDone,
      issuesFramed,
      verdictReady: verdictDelivered,
      lastSpeaker: lastSpeaker === "clerk" ? null : lastSpeaker,
      derivedPhase: hearingPhase,
      forceEnd: opts?.forceEnd ?? false,
      forceSpeaker: opts?.forceSpeaker ?? null,
    };
  };

  const agentResponseToTurn = (api: CourtroomAgentTurnResponse): HearingTurn => {
    const role = api.speaker;
    const verifiedSources: LegalAuthority[] = api.verifiedSources.map((s, i) =>
      mapVerifiedSource(s, `V${i + 1}`, role),
    );
    return {
      speaker: role,
      text: api.text,
      textHi: api.textHi ?? undefined,
      addressesPointIds: api.addressesPointIds,
      verifiedCiteIds: api.citeSourceIds,
      verifiedSources,
      exhibitActions: api.exhibitActions,
      timelineStep: (api.timelineStep as HearingTimelineStep) || hearingPhase,
      judgeState: api.judgeState ?? undefined,
      judgeNote: api.judgeNote ?? undefined,
    };
  };

  const syncBlackboard = (api: CourtroomAgentTurnResponse) => {
    const bb = api.blackboard;
    if (!bb) return;
    if (bb.agenda?.length) {
      agenda = bb.agenda.map((a) => ({
        id: a.id,
        label: a.label,
        source: (agenda.find((x) => x.id === a.id)?.source ?? "matter") as HearingAgendaItem["source"],
        status: a.status as HearingAgendaItem["status"],
      }));
      emitCoverage();
    }
    if (bb.exhibits?.length) {
      const nextEx: Exhibit[] = bb.exhibits.map((e) => {
        const prev = state.exhibits.find((x) => x.id === e.id);
        return {
          id: e.id,
          title: e.title,
          type: prev?.type ?? "Document",
          status: e.status as ExhibitStatus,
          source: prev?.source,
        };
      });
      state = { ...state, exhibits: nextEx };
      nextEx.forEach((ex) => emit({ type: "exhibitUpdate", exhibit: ex }));
    }
    counselTurns = bb.counselTurns;
    judgeTurns = bb.judgeTurns;
    closingsDone = bb.closingsDone;
    issuesFramed = bb.issuesFramed;
    if (bb.derivedPhase) {
      setPhaseLabel(bb.derivedPhase as HearingPhase);
    }
    if (bb.compressedCase) compressedCase = bb.compressedCase;
    if (bb.extractedFacts?.length) extractedFacts = bb.extractedFacts;
    if (bb.runningMemory != null) runningMemory = bb.runningMemory || "";
    if (bb.scratchpads) scratchpads = { ...bb.scratchpads };
    if (bb.transcriptTurns?.length) transcriptTurns = bb.transcriptTurns;
  };

  const cancelPrefetch = () => {
    prefetchController?.abort();
    prefetchController = null;
    prefetchPromise = null;
  };

  const startPrefetch = () => {
    if (!config || disposed || state.phase !== "hearing" || verdictDelivered) return;
    cancelPrefetch();
    prefetchController = new AbortController();
    const ctrl = prefetchController;
    prefetchPromise = runCourtroomAgentTurn(buildAgentPayload(), {
      signal: ctrl.signal,
    }).catch(() => {
      prefetchPromise = null;
      return Promise.reject(new Error("prefetch aborted"));
    }) as Promise<CourtroomAgentTurnResponse>;
  };

  const finishHearing = async () => {
    if (disposed || !config) return;
    if (state.phase !== "hearing" && state.phase !== "deliberation") return;
    awaitingSpeech = false;
    cancelPrefetch();
    setThinking(false);
    emitCoverage();
    refreshDerivedMetrics();
    setPhaseLabel("deliberation");
    state = {
      ...state,
      phase: "deliberation",
      activeSpeaker: null,
      judgeState: "deliberating",
      timelineStep: "deliberation",
      judgeNote: "Reducing oral order into a simulated written judgment",
    };
    emit({ type: "phaseChange", phase: "deliberation" });
    emit({ type: "speakerChange", role: null });
    emit({
      type: "judgeState",
      state: "deliberating",
      note: "Reducing oral order into a simulated written judgment",
    });

    const report = await buildJudgmentReport();
    if (disposed || !config) return;
    state = {
      ...state,
      judgment: report,
      phase: "judgment",
      judgeState: "ruling",
      activeSpeaker: "judge",
      judgeNote: "Simulated judgment pronounced",
      timelineStep: "verdict",
    };
    emit({ type: "judgmentReady", report });
    emit({ type: "judgeState", state: "ruling", note: "Simulated judgment pronounced" });
    emit({ type: "phaseChange", phase: "judgment" });
    emit({ type: "speakerChange", role: "judge" });
  };

  const scriptAbort = () => disposed || !config || state.phase !== "hearing";

  const generateTurn = async () => {
    if (generating || scriptAbort() || state.isPaused) return;
    if (awaitingSpeech && speechGated) return;

    if (verdictDelivered) {
      await finishHearing();
      return;
    }

    generating = true;
    setThinking(true);
    abortController?.abort();
    abortController = new AbortController();

    let api: CourtroomAgentTurnResponse | null = null;
    try {
      if (prefetchPromise) {
        try {
          api = await prefetchPromise;
        } catch {
          api = null;
        }
        prefetchPromise = null;
      }
      if (!api) {
        api = await runCourtroomAgentTurn(
          buildAgentPayload({
            forceEnd: turnIndex >= MAX_TURNS,
            forceSpeaker: turnIndex >= MAX_TURNS ? "judge" : null,
          }),
          { signal: abortController.signal },
        );
      }
    } catch {
      api = null;
    }

    if (scriptAbort() || state.isPaused) {
      generating = false;
      setThinking(false);
      return;
    }

    let turn: HearingTurn;
    let isVerdict = false;
    if (api?.text) {
      syncBlackboard(api);
      turn = agentResponseToTurn(api);
      isVerdict = Boolean(api.isVerdict) || api.timelineStep === "verdict";
      if (!issuesFramed && api.blackboard?.issuesFramed) issuesFramed = true;
    } else {
      const role = lastSpeaker === "petitioner" ? "respondent" : "petitioner";
      turn = fallbackTurn(role, config!, agenda, hearingPhase);
    }

    state = { ...state, activeSpeaker: turn.speaker };
    emit({ type: "speakerChange", role: turn.speaker });
    setThinking(false);
    applyTurn(turn, { isVerdict });
    generating = false;

    if (!speechGated) {
      setTimeout(() => {
        if (!state.isPaused && state.phase === "hearing") void generateTurn();
      }, UNGATED_DELAY_MS);
    } else if (!verdictDelivered) {
      startPrefetch();
    }
  };

  const buildJudgmentReport = async (): Promise<JudgmentReport> => {
    const pct = coveragePercent(agenda);
    const uncovered = notCoveredPoints(agenda);
    const quality = authoritiesQuality(state.authorities);
    const { metrics, methodology } = deriveHearingMetrics({
      agenda,
      authorities: state.authorities,
      exhibits: state.exhibits,
      objections: state.objections,
    });
    const coverageSummary =
      uncovered.length === 0
        ? `${pct}% of agenda points were contested or resolved during the hearing.`
        : `${pct}% contested/resolved. Issues not fully argued: ${uncovered
            .map((u) => u.label)
            .join("; ")}.`;

    const base: JudgmentReport = {
      matterTitle: config!.matterTitle,
      issuesFramed: agenda.slice(0, 5).map((a) => a.label),
      findingsOfFact: agenda.slice(0, 5).map((a) => `${a.label} (${a.status})`),
      legalReasoning:
        "On the simulated Indian hearing record, both sides were heard via agentic counsel and bench. The Court structures issues, findings, and an operative portion for case-strength analysis only.",
      confidence: metrics,
      confidenceMethodology: methodology,
      authorities: state.authorities,
      authoritiesQuality: quality,
      nextSteps: [
        ...uncovered.slice(0, 3).map((u) => `Argue and prove: ${u.label}`),
        "Shore up documentary proof on contested agenda points.",
      ].slice(0, 5),
      disposition:
        oralVerdictText ||
        "Simulated — petition disposed of on the hearing record with liberty to strengthen pleadings and evidence.",
      oralVerdict: oralVerdictText || undefined,
      generatedAt: new Date().toISOString(),
      intakeSummary: config!.intake?.summary,
      agentSummaries: config!.agents?.map(
        (a) => `${a.displayName}: ${a.strategy.slice(0, 2).join("; ")}`,
      ),
      timelineSteps: [
        "appearance",
        "issues_framed",
        "evidence_marking",
        "submissions",
        "reply",
        "closing",
        "verdict",
        "deliberation",
      ],
      coveragePercent: pct,
      coverageSummary,
      notCovered: uncovered.map((u) => u.label),
      weaknessesExposed: uncovered.map((u) => u.label).slice(0, 5),
    };

    try {
      abortController?.abort();
      abortController = new AbortController();
      let raw = "";
      const result = await streamResearch(
        buildJudgmentPrompt({
          config: config!,
          agenda,
          transcript: state.transcript,
          coveragePercent: pct,
          oralVerdict: oralVerdictText || undefined,
          notCovered: uncovered.map((u) => u.label),
        }),
        undefined,
        [],
        { onToken: (t) => { raw += t; } },
        { signal: abortController.signal },
      );
      const parsed = parseJudgmentJson(raw || result.answer || "");
      return {
        ...base,
        issuesFramed: parsed.issuesFramed ?? base.issuesFramed,
        findingsOfFact: parsed.findingsOfFact ?? base.findingsOfFact,
        findingsOfFactHi: parsed.findingsOfFactHi,
        legalReasoning: parsed.legalReasoning ?? base.legalReasoning,
        legalReasoningHi: parsed.legalReasoningHi,
        disposition: parsed.disposition ?? base.disposition,
        dispositionHi: parsed.dispositionHi,
        oralVerdict: parsed.oralVerdict ?? base.oralVerdict,
        oralVerdictHi: parsed.oralVerdictHi,
        nextSteps: parsed.nextSteps ?? base.nextSteps,
        nextStepsHi: parsed.nextStepsHi,
        strongestPetitioner: parsed.strongestPetitioner,
        strongestRespondent: parsed.strongestRespondent,
        weaknessesExposed: parsed.weaknessesExposed ?? base.weaknessesExposed,
        coverageSummary: parsed.coverageSummary ?? base.coverageSummary,
        coveragePercent: pct,
        notCovered: base.notCovered,
        confidence: metrics,
        confidenceMethodology: methodology,
        authoritiesQuality: quality,
        authorities: state.authorities,
      };
    } catch {
      return base;
    }
  };

  const startTick = () => {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = setInterval(() => {
      if (state.isPaused || state.phase === "setup" || state.phase === "judgment") return;
      state = { ...state, elapsedSeconds: state.elapsedSeconds + 1 };
      emit({ type: "tick", elapsedSeconds: state.elapsedSeconds });
    }, 1000);
  };

  const objectionLabel = (type: ObjectionType): string => {
    const map: Record<ObjectionType, string> = {
      relevance: "relevance",
      leading: "leading question",
      no_foundation: "want of foundation",
      beyond_pleadings: "beyond pleadings",
      hearsay: "hearsay",
      procedure: "procedure",
    };
    return map[type] ?? type;
  };

  return {
    getState: () => state,

    start(sessionConfig: CourtroomSessionConfig) {
      disposed = false;
      if (tickTimer) clearInterval(tickTimer);
      abortController?.abort();
      cancelPrefetch();
      config = sessionConfig;
      agenda = buildCoverageAgenda(sessionConfig, sessionConfig.intake);
      turnIndex = 0;
      hearingPhase = "issues_framed";
      closingsDone = 0;
      counselTurns = 0;
      judgeTurns = 0;
      verdictDelivered = false;
      oralVerdictText = "";
      awaitingSpeech = false;
      generating = false;
      issuesFramed = false;
      lastSpeaker = null;
      compressedCase = "";
      extractedFacts = [];
      runningMemory = "";
      scratchpads = {};
      transcriptTurns = [];
      const preset = sessionConfig.presetId ? getDemoPreset(sessionConfig.presetId) : undefined;
      const exhibits = sessionConfig.exhibits.map((e) => ({
        ...e,
        status: e.status === "admitted" ? ("pending" as const) : e.status,
      }));
      state = {
        ...initialState(),
        phase: "hearing",
        exhibits,
        authorities: preset
          ? preset.authorities.map((a) => ({
              ...a,
              verified: a.verified ?? false,
              sourceKind: a.sourceKind ?? "freeform",
            }))
          : [],
        judgeNote: "Court is in session — agentic hearing",
        agenda: [...agenda],
        timelineStep: "appearance",
      };
      preset?.authorities.forEach((a) => emit({ type: "authorityCited", authority: a }));
      emit({ type: "phaseChange", phase: "hearing" });
      emitCoverage();
      refreshDerivedMetrics();
      startTick();

      const openText = `Court Master: Matter called — ${sessionConfig.matterTitle}. Appearance of counsel for both sides. Agentic AI Courtroom Simulation — not a real court.`;
      addTranscript("clerk", openText, toHindiCompanion(openText));
      setPhaseLabel("issues_framed");
      if (speechGated) {
        awaitingSpeech = true;
        startPrefetch();
      } else {
        setTimeout(() => void generateTurn(), 400);
      }
    },

    pause() {
      if (state.isPaused || state.phase !== "hearing") return;
      state = { ...state, isPaused: true };
      abortController?.abort();
      cancelPrefetch();
      setThinking(false);
      emit({ type: "paused", paused: true });
    },

    resume() {
      if (!state.isPaused || state.phase !== "hearing") return;
      state = { ...state, isPaused: false };
      emit({ type: "paused", paused: false });
      if (!awaitingSpeech && !generating) {
        void generateTurn();
      }
    },

    endArguments() {
      if (state.phase !== "hearing") return;
      abortController?.abort();
      cancelPrefetch();
      generating = false;
      setThinking(false);
      awaitingSpeech = false;
      if (!verdictDelivered) {
        void (async () => {
          generating = true;
          setThinking(true);
          try {
            const api = await runCourtroomAgentTurn(
              buildAgentPayload({ forceEnd: true, forceSpeaker: "judge" }),
            );
            syncBlackboard(api);
            const turn = agentResponseToTurn(api);
            setThinking(false);
            applyTurn(turn, { isVerdict: true });
            generating = false;
            await finishHearing();
          } catch {
            generating = false;
            setThinking(false);
            void finishHearing();
          }
        })();
        return;
      }
      void finishHearing();
    },

    raiseObjection(type: ObjectionType) {
      if (state.phase !== "hearing" || generating) return;
      const by: SpeakerRole =
        state.activeSpeaker === "respondent" ? "petitioner" : "respondent";
      const sustainPrefer: ObjectionType[] = [
        "no_foundation",
        "beyond_pleadings",
        "leading",
        "relevance",
      ];
      const ruling = sustainPrefer.includes(type) ? "sustained" : "overruled";
      const label = objectionLabel(type);
      const noteEn =
        ruling === "sustained"
          ? `Objection as to ${label} is sustained. Counsel shall confine to the pleadings and the marked record.`
          : `Objection as to ${label} is overruled. The Court will assess weight at the appropriate stage.`;
      const event = {
        id: `obj-${Date.now()}`,
        by,
        type,
        ruling: ruling as "sustained" | "overruled",
        timestamp: state.elapsedSeconds,
        note: noteEn,
      };
      state = { ...state, objections: [...state.objections, event], judgeState: "ruling" };
      emit({ type: "objectionRuling", event });
      emit({ type: "judgeState", state: "ruling", note: noteEn });
      addTranscript("judge", noteEn, toHindiCompanion(noteEn));
      refreshDerivedMetrics();
      if (speechGated) awaitingSpeech = true;
      else setTimeout(() => void generateTurn(), 400);
    },

    setSpeechGated(enabled: boolean) {
      speechGated = enabled;
      if (!enabled && awaitingSpeech) {
        awaitingSpeech = false;
        if (!state.isPaused && state.phase === "hearing") void generateTurn();
      }
    },

    advanceScript() {
      if (!awaitingSpeech) return;
      awaitingSpeech = false;
      if (state.isPaused || state.phase !== "hearing") return;
      void generateTurn();
    },

    revealJudgment() {
      if (!state.judgment) return;
      if (state.phase === "judgment") return;
      state = {
        ...state,
        phase: "judgment",
        judgeState: "ruling",
        activeSpeaker: "judge",
        judgeNote: "Simulated judgment pronounced",
        timelineStep: "verdict",
      };
      emit({ type: "judgeState", state: "ruling", note: "Simulated judgment pronounced" });
      emit({ type: "phaseChange", phase: "judgment" });
      emit({ type: "speakerChange", role: "judge" });
    },

    isAwaitingSpeech() {
      return awaitingSpeech;
    },

    subscribe(listener: CourtroomListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispose() {
      disposed = true;
      abortController?.abort();
      cancelPrefetch();
      if (tickTimer) clearInterval(tickTimer);
      listeners.clear();
      state = initialState();
    },
  };
}
