import { streamResearch } from "@/lib/api";
import type { CourtroomSimulationAdapter } from "@/lib/courtroom/adapter";
import {
  buildCoverageAgenda,
  coveragePercent,
  forceResolvePending,
  markAgendaPoints,
  uncoveredPoints,
} from "@/lib/courtroom/hearing-agenda";
import {
  buildJudgmentPrompt,
  buildTurnPrompt,
  buildVerdictPrompt,
  parseHearingTurn,
  parseJudgmentJson,
} from "@/lib/courtroom/hearing-prompts";
import { getDemoPreset } from "@/lib/courtroom/demo-sessions";
import { toHindiCompanion } from "@/lib/courtroom/bilingual";
import type {
  CourtroomEvent,
  CourtroomListener,
  CourtroomSessionConfig,
  CourtroomState,
  HearingAgendaItem,
  HearingMetrics,
  HearingTurn,
  JudgmentReport,
  ObjectionType,
  SpeakerRole,
  TranscriptEntry,
} from "@/lib/courtroom/types";

const MAX_TURNS = 24;
const COVERAGE_TARGET = 90;

function initialState(): CourtroomState {
  return {
    phase: "setup",
    activeSpeaker: null,
    judgeState: "listening",
    timelineStep: "opening",
    transcript: [],
    exhibits: [],
    authorities: [],
    objections: [],
    metrics: {
      argumentStrength: 0.45,
      evidenceSupport: 0.4,
      proceduralCompliance: 0.85,
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

function fallbackTurn(
  role: SpeakerRole,
  config: CourtroomSessionConfig,
  agenda: HearingAgendaItem[],
  forceClosing: boolean,
): HearingTurn {
  const open = uncoveredPoints(agenda)[0];
  const pointIds = open ? [open.id] : [];
  if (role === "judge") {
    return {
      speaker: "judge",
      text: open
        ? `Counsel, confine yourselves to the record. Address specifically: ${open.label}`
        : "The Court has noted the submissions. Proceed to closing if ready.",
      textHi: open
        ? `अधिवक्तागण, रिकॉर्ड तक सीमित रहें। विशेष रूप से संबोधित करें: ${open.label}`
        : "न्यायालय ने निवेदन नोट किए। समापन तर्क प्रस्तुत करें।",
      addressesPointIds: pointIds,
      suggestJudgeIntervene: false,
      timelineStep: forceClosing ? "closing" : "examination",
      judgeState: "questioning",
      judgeNote: "Testing the record",
    };
  }
  if (forceClosing) {
    const text =
      role === "petitioner"
        ? `In closing, on the pleaded ${config.matterType} case, we pray for the relief sought and ask that the Court weigh the documentary record in our favour.`
        : `In closing, the petition fails on the record. No case for the relief claimed is made out.`;
    return {
      speaker: role,
      text,
      textHi: toHindiCompanion(text),
      addressesPointIds: pointIds,
      timelineStep: "closing",
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
    timelineStep: "examination",
    metricsDelta: {
      argumentStrength: role === "petitioner" ? 0.58 : 0.52,
      evidenceSupport: 0.5,
    },
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
  let nextRole: SpeakerRole = "petitioner";
  let forceJudgeNext = false;
  let closingPhase = false;
  let closingsDone = 0;
  let verdictDelivered = false;
  let oralVerdictText = "";
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let abortController: AbortController | null = null;
  let generating = false;
  let disposed = false;

  const emit = (event: CourtroomEvent) => {
    listeners.forEach((l) => l(event));
  };

  const setThinking = (active: boolean) => {
    state = { ...state, isThinking: active };
    emit({ type: "thinking", active });
  };

  const updateMetrics = (partial?: Partial<HearingMetrics>) => {
    if (!partial) return;
    state = { ...state, metrics: { ...state.metrics, ...partial } };
    emit({ type: "metricsUpdate", metrics: state.metrics });
  };

  const emitCoverage = () => {
    state = { ...state, agenda: [...agenda] };
    emit({ type: "coverageUpdate", agenda: [...agenda] });
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
  };

  const applyTurn = (turn: HearingTurn) => {
    if (!config) return;
    const role = turn.speaker === "clerk" ? nextRole : turn.speaker;
    if (turn.timelineStep) {
      state = { ...state, timelineStep: turn.timelineStep };
      emit({ type: "timelineStep", step: turn.timelineStep });
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
    updateMetrics(turn.metricsDelta);
    agenda = markAgendaPoints(agenda, turn.addressesPointIds, role);
    emitCoverage();

    if (turn.cites?.length) {
      turn.cites.forEach((cite, i) => {
        const authority = {
          id: `live-${Date.now()}-${i}`,
          marker: `L${state.authorities.length + 1}`,
          title: cite,
          citation: cite,
          citedBy: role === "clerk" ? undefined : role,
        };
        if (!state.authorities.some((a) => a.title === cite)) {
          state = { ...state, authorities: [...state.authorities, authority] };
          emit({ type: "authorityCited", authority });
        }
      });
    }

    addTranscript(role, turn.text, turn.textHi);
    turnIndex += 1;

    if (role === "petitioner" || role === "respondent") {
      nextRole = role === "petitioner" ? "respondent" : "petitioner";
    }
    if (turn.suggestJudgeIntervene && role !== "judge") {
      forceJudgeNext = true;
    }
    if (closingPhase && (role === "petitioner" || role === "respondent")) {
      closingsDone += 1;
    }

    if (speechGated) {
      awaitingSpeech = true;
    }
  };

  const shouldClose = () => {
    if (turnIndex >= MAX_TURNS) return true;
    return coveragePercent(agenda) >= COVERAGE_TARGET && turnIndex >= 6;
  };

  const pickRole = (): Exclude<SpeakerRole, "clerk"> => {
    // Closings are sacrosanct — do not insert intervenor turns mid-closing
    if (closingPhase) {
      if (closingsDone === 0) return "petitioner";
      if (closingsDone === 1) return "respondent";
      return "judge";
    }
    if (forceJudgeNext) {
      forceJudgeNext = false;
      return "judge";
    }
    if (turnIndex > 0 && turnIndex % 5 === 0) return "judge";
    if (uncoveredPoints(agenda).length > 0 && turnIndex > 2 && turnIndex % 4 === 3) {
      return "judge";
    }
    return nextRole === "respondent" ? "respondent" : "petitioner";
  };

  const finishHearing = async () => {
    // May be called while still in hearing (after oral verdict) or mid-transition
    if (disposed || !config) return;
    if (state.phase !== "hearing" && state.phase !== "deliberation") return;
    awaitingSpeech = false;
    setThinking(false);
    agenda = forceResolvePending(agenda);
    emitCoverage();
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

  const fallbackVerdict = (): HearingTurn => {
    const open = uncoveredPoints(agenda)[0];
    const text = open
      ? `We have heard learned counsel for both sides. On the decisive issue touching ${open.label}, and confined to the simulation record, this Court partly allows the prayer with liberty to the parties to strengthen the documentary proof. Ordered accordingly.`
      : `We have heard learned counsel for both sides. On the pleadings and submissions recorded in this simulation, the petition is disposed of with directions that parties fortify evidence on contested points. Ordered accordingly.`;
    return {
      speaker: "judge",
      text,
      textHi: toHindiCompanion(text),
      addressesPointIds: open ? [open.id] : [],
      timelineStep: "verdict",
      judgeState: "ruling",
      judgeNote: "Operative order pronounced",
      metricsDelta: { proceduralCompliance: 0.92 },
    };
  };

  const generateTurn = async () => {
    if (generating || scriptAbort() || state.isPaused) return;
    if (awaitingSpeech && speechGated) return;

    // After oral verdict is on the transcript, reduce it to written judgment
    if (verdictDelivered) {
      await finishHearing();
      return;
    }

    if (shouldClose() && !closingPhase) {
      closingPhase = true;
      closingsDone = 0;
    }

    // Closings done → mandatory Judge oral verdict (never skip)
    const needVerdict = closingPhase && closingsDone >= 2;

    generating = true;
    setThinking(true);
    const role: Exclude<SpeakerRole, "clerk"> = needVerdict ? "judge" : pickRole();
    nextRole = role;
    state = {
      ...state,
      activeSpeaker: role,
      ...(needVerdict
        ? { timelineStep: "verdict" as const, judgeState: "ruling" as const }
        : {}),
    };
    emit({ type: "speakerChange", role });
    if (needVerdict) {
      emit({ type: "timelineStep", step: "verdict" });
      emit({ type: "judgeState", state: "ruling", note: "Pronouncing oral order" });
    }

    abortController?.abort();
    abortController = new AbortController();
    let turn: HearingTurn;

    try {
      const prompt = needVerdict
        ? buildVerdictPrompt({
            config: config!,
            agenda,
            transcript: state.transcript,
            agents: config!.agents,
          })
        : buildTurnPrompt({
            config: config!,
            role,
            agenda,
            transcript: state.transcript,
            agents: config!.agents,
            turnIndex,
            forceClosing: closingPhase && !needVerdict,
            intervene: role === "judge",
          });
      let raw = "";
      const result = await streamResearch(
        prompt,
        undefined,
        [],
        { onToken: (t) => { raw += t; } },
        { signal: abortController.signal },
      );
      const text = raw || result.answer || "";
      turn = parseHearingTurn(text, role);
      turn.speaker = role;
      if (needVerdict) {
        turn.timelineStep = "verdict";
        turn.judgeState = "ruling";
      }
    } catch {
      turn = needVerdict
        ? fallbackVerdict()
        : fallbackTurn(role, config!, agenda, closingPhase);
    }

    if (scriptAbort() || state.isPaused) {
      generating = false;
      setThinking(false);
      return;
    }

    setThinking(false);
    applyTurn(turn);
    if (needVerdict) {
      verdictDelivered = true;
      oralVerdictText = turn.text;
    }
    generating = false;

    if (!speechGated) {
      setTimeout(() => {
        if (!state.isPaused && state.phase === "hearing") void generateTurn();
      }, needVerdict ? 2200 : 1600);
    }
  };

  const buildJudgmentReport = async (): Promise<JudgmentReport> => {
    const pct = coveragePercent(agenda);
    const base: JudgmentReport = {
      matterTitle: config!.matterTitle,
      issuesFramed: agenda.slice(0, 5).map((a) => a.label),
      findingsOfFact: agenda.slice(0, 5).map((a) => `${a.label} (${a.status})`),
      legalReasoning:
        "On the simulated Indian hearing record, both sides were heard. The Court structures issues, findings, and an operative portion for case-strength analysis only.",
      confidence: state.metrics,
      authorities: state.authorities,
      nextSteps: [
        "Shore up documentary proof on contested agenda points.",
        "Prepare focused written submissions on uncovered weaknesses.",
        "Consider settlement leverage revealed by the adversarial exchange.",
      ],
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
        "opening",
        "examination",
        "objections",
        "closing",
        "verdict",
        "deliberation",
      ],
      coveragePercent: pct,
      coverageSummary: `${pct}% of agenda points were raised or contested during the hearing.`,
    };

    try {
      abortController = new AbortController();
      let raw = "";
      const result = await streamResearch(
        buildJudgmentPrompt({
          config: config!,
          agenda,
          transcript: state.transcript,
          coveragePercent: pct,
          oralVerdict: oralVerdictText || undefined,
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
        weaknessesExposed: parsed.weaknessesExposed,
        coverageSummary: parsed.coverageSummary ?? base.coverageSummary,
        coveragePercent: pct,
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

  return {
    getState: () => state,

    start(sessionConfig: CourtroomSessionConfig) {
      disposed = false;
      if (tickTimer) clearInterval(tickTimer);
      abortController?.abort();
      config = sessionConfig;
      agenda = buildCoverageAgenda(sessionConfig, sessionConfig.intake);
      turnIndex = 0;
      nextRole = "petitioner";
      forceJudgeNext = false;
      closingPhase = false;
      closingsDone = 0;
      verdictDelivered = false;
      oralVerdictText = "";
      awaitingSpeech = false;
      generating = false;
      // Prefer caller's Listening Mode; do not force-reset speechGated here
      const preset = sessionConfig.presetId ? getDemoPreset(sessionConfig.presetId) : undefined;
      state = {
        ...initialState(),
        phase: "hearing",
        exhibits: [...sessionConfig.exhibits],
        authorities: preset ? [...preset.authorities] : [],
        judgeNote: "Court is in session",
        agenda: [...agenda],
      };
      preset?.authorities.forEach((a) => emit({ type: "authorityCited", authority: a }));
      emit({ type: "phaseChange", phase: "hearing" });
      emitCoverage();
      startTick();

      const openText = `Court Master: Matter called — ${sessionConfig.matterTitle}. Appearance of counsel. AI Courtroom Simulation under Indian procedure idioms — not a real court. Parties may proceed.`;
      addTranscript("clerk", openText, toHindiCompanion(openText));
      if (speechGated) {
        awaitingSpeech = true;
      } else {
        setTimeout(() => void generateTurn(), 800);
      }
    },

    pause() {
      if (state.isPaused || state.phase !== "hearing") return;
      state = { ...state, isPaused: true };
      abortController?.abort();
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
      generating = false;
      setThinking(false);
      // Close the bar: skip remaining closings → oral verdict → written order
      closingPhase = true;
      closingsDone = Math.max(closingsDone, 2);
      awaitingSpeech = false;
      if (!verdictDelivered) {
        void generateTurn();
        return;
      }
      void finishHearing();
    },

    raiseObjection(type: ObjectionType) {
      if (state.phase !== "hearing" || generating) return;
      const by: SpeakerRole =
        state.activeSpeaker === "respondent" ? "petitioner" : "respondent";
      const ruling = type === "hearsay" ? "overruled" : "sustained";
      const noteEn =
        ruling === "sustained"
          ? `Objection as to ${type} is sustained. Counsel shall confine to the record.`
          : `Objection as to ${type} is overruled. Weight will be assessed in deliberation.`;
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
      forceJudgeNext = false;
      nextRole = by === "petitioner" ? "respondent" : "petitioner";
      if (speechGated) awaitingSpeech = true;
      else setTimeout(() => void generateTurn(), 1200);
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
      // After clerk opening, start advocate turns
      void generateTurn();
    },

    revealJudgment() {
      // Judgment phase is auto-entered after oral verdict + written order.
      // Keep this for UI that still calls it (idempotent).
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
      if (tickTimer) clearInterval(tickTimer);
      listeners.clear();
      state = initialState();
    },
  };
}
