"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CaseAnalysisPipeline } from "@/components/courtroom/case-analysis-pipeline";
import { CourtroomControls } from "@/components/courtroom/courtroom-controls";
import { CourtroomEmptyState } from "@/components/courtroom/courtroom-empty-state";
import { CourtroomHero } from "@/components/courtroom/courtroom-hero";
import { CourtroomLanguageToggle } from "@/components/courtroom/courtroom-language-toggle";
import { CourtroomListeningToggle } from "@/components/courtroom/courtroom-listening-toggle";
import { CitationsPanel } from "@/components/courtroom/citations-panel";
import { EvidencePanel } from "@/components/courtroom/evidence-panel";
import { HearingTimeline } from "@/components/courtroom/hearing-timeline";
import { HearingTimer } from "@/components/courtroom/hearing-timer";
import { PastSimulationsPanel } from "@/components/courtroom/past-simulations-panel";
import { CoverageTracker } from "@/components/courtroom/coverage-tracker";
import { HearingChat } from "@/components/courtroom/hearing-chat";
import { HearingStage } from "@/components/courtroom/hearing-stage";
import { ObjectionBar } from "@/components/courtroom/objection-bar";
import { ValidationMeters } from "@/components/courtroom/validation-meters";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourtroomSpeech } from "@/hooks/use-courtroom-speech";
import {
  useHearingLinePipeline,
  useHearingTranscriptWatcher,
} from "@/hooks/use-hearing-line-pipeline";
import { proposeCourtroomActions } from "@/lib/api";
import { createEmptyIntakeBundle, hasMinimumIntake } from "@/lib/courtroom/case-bundle";
import { getDemoPreset } from "@/lib/courtroom/demo-sessions";
import { processCaseIntake } from "@/lib/courtroom/intake-processor";
import { createLlmCourtroomAdapter } from "@/lib/courtroom/llm-adapter";
import { refineAgentsWithLlm } from "@/lib/courtroom/llm-courtroom";
import {
  buildActionsPayload,
  buildCourtroomRunRecord,
  deleteCourtroomRun,
  listCourtroomRuns,
  loadActionChecklist,
  saveActionChecklist,
  upsertCourtroomRun,
} from "@/lib/courtroom/session-store";
import { buildActionPlanMarkdown } from "@/components/courtroom/action-plan-panel";
import type {
  ActionPlanStatus,
  AgentPersona,
  CaseIntakeBundle,
  CourtroomEvent,
  CourtroomPhase,
  CourtroomRunRecord,
  CourtroomSessionConfig,
  CourtroomState,
  JudgmentReport,
  ProcessingStep,
  ProposedActionPlan,
  TranscriptEntry,
  TranscriptLanguage,
} from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

const panelFallback = () => <Skeleton className="h-48 w-full rounded-2xl" />;

const AgentForgePanel = dynamic(
  () =>
    import("@/components/courtroom/agent-forge-panel").then((m) => ({
      default: m.AgentForgePanel,
    })),
  { loading: panelFallback },
);
const DeliberationScreen = dynamic(
  () =>
    import("@/components/courtroom/deliberation-screen").then((m) => ({
      default: m.DeliberationScreen,
    })),
  { loading: panelFallback },
);
const PrepareCasePanel = dynamic(
  () =>
    import("@/components/courtroom/prepare-case-panel").then((m) => ({
      default: m.PrepareCasePanel,
    })),
  { loading: panelFallback },
);
const JudgmentScreen = dynamic(
  () =>
    import("@/components/courtroom/judgment-screen").then((m) => ({
      default: m.JudgmentScreen,
    })),
  { loading: panelFallback },
);

const DEFAULT_CONFIG: CourtroomSessionConfig = {
  matterTitle: "",
  matterType: "Commercial",
  petitionerName: "Adv. Priya Sharma",
  respondentName: "Adv. Rajesh Mehta",
  exhibits: [],
};

type MobileTab = "transcript" | "exhibits" | "authorities" | "metrics";
type PrepPhase = "setup" | "processing" | "agentsReady";

function displayPhase(adapterPhase: CourtroomPhase, prepPhase: PrepPhase): CourtroomPhase {
  if (adapterPhase !== "setup") return adapterPhase;
  return prepPhase;
}

function speechLocaleForLanguage(language: TranscriptLanguage): "en-IN" | "hi-IN" {
  return language === "hi" ? "hi-IN" : "en-IN";
}

export default function CourtroomPage() {
  const adapterRef = useRef(createLlmCourtroomAdapter());
  const [config, setConfig] = useState<CourtroomSessionConfig>(DEFAULT_CONFIG);
  const [state, setState] = useState<CourtroomState>(adapterRef.current.getState());
  const [prepPhase, setPrepPhase] = useState<PrepPhase>("setup");
  const [intakeBundle, setIntakeBundle] = useState<CaseIntakeBundle>(createEmptyIntakeBundle);
  const [agents, setAgents] = useState<AgentPersona[]>([]);
  const [displayLanguage, setDisplayLanguage] = useState<TranscriptLanguage>("en");
  const [listeningMode, setListeningMode] = useState(true);
  const [judgmentRevealed, setJudgmentRevealed] = useState(false);
  const [actionPlanStatus, setActionPlanStatus] = useState<ActionPlanStatus>("idle");
  const [actionPlan, setActionPlan] = useState<ProposedActionPlan | null>(null);
  const [checkedActionIds, setCheckedActionIds] = useState<string[]>([]);
  const [pastRuns, setPastRuns] = useState<CourtroomRunRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [reviewingRunId, setReviewingRunId] = useState<string | null>(null);
  const [reviewingSavedAt, setReviewingSavedAt] = useState<string | null>(null);
  const actionsAbortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);
  const [speakingEntryId, setSpeakingEntryId] = useState<string | null>(null);
  const [typingEntryId, setTypingEntryId] = useState<string | null>(null);
  const [typingCharCount, setTypingCharCount] = useState(0);
  const [completedLineIds, setCompletedLineIds] = useState<Set<string>>(() => new Set());
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>("extracting");
  const [buildingAgents, setBuildingAgents] = useState(false);
  const pdfFilesRef = useRef(new Map<string, File>());
  const isPausedRef = useRef(false);
  isPausedRef.current = state.isPaused;
  const [mobileTab, setMobileTab] = useState<MobileTab>("transcript");
  const [transcriptViewMode, setTranscriptViewMode] = useState<"chat" | "order_sheet">("chat");

  const courtroomSpeech = useCourtroomSpeech(speechLocaleForLanguage(displayLanguage));
  const courtroomSpeechRef = useRef(courtroomSpeech);
  courtroomSpeechRef.current = courtroomSpeech;
  const transcriptRef = useRef(state.transcript);
  transcriptRef.current = state.transcript;

  const phase = displayPhase(state.phase, prepPhase);

  const handleLineComplete = useCallback(
    (entry: TranscriptEntry) => {
      setCompletedLineIds((prev) => new Set(prev).add(entry.id));
      setSpeakingEntryId(null);
      if (
        listeningMode &&
        !adapterRef.current.getState().isPaused &&
        adapterRef.current.isAwaitingSpeech()
      ) {
        adapterRef.current.advanceScript();
      }
    },
    [listeningMode],
  );

  const handleTypingUpdate = useCallback((entryId: string | null, charCount: number) => {
    setTypingEntryId(entryId);
    setTypingCharCount(charCount);
  }, []);

  const { enqueue: enqueueLine, reset: resetLinePipeline } = useHearingLinePipeline({
    listeningMode,
    displayLanguage,
    phase,
    isPaused: () => isPausedRef.current,
    speech: courtroomSpeech,
    onLineComplete: handleLineComplete,
    onTypingUpdate: handleTypingUpdate,
  });

  useHearingTranscriptWatcher(state.transcript, phase, (entry) => {
    if (listeningMode) enqueueLine(entry);
  });

  const visibleTranscript = useMemo(() => {
    if (!listeningMode || phase !== "hearing") return state.transcript;
    return state.transcript.filter(
      (e) => completedLineIds.has(e.id) || e.id === typingEntryId,
    );
  }, [state.transcript, listeningMode, phase, completedLineIds, typingEntryId]);

  const applyEvent = useCallback((event: CourtroomEvent) => {
    setState((prev) => {
      const next = { ...prev };
      switch (event.type) {
        case "transcript":
          next.transcript = [...prev.transcript, event.entry];
          break;
        case "speakerChange":
          next.activeSpeaker = event.role;
          break;
        case "thinking":
          next.isThinking = event.active;
          break;
        case "timelineStep":
          next.timelineStep = event.step;
          break;
        case "judgeState":
          next.judgeState = event.state;
          next.judgeNote = event.note ?? prev.judgeNote;
          break;
        case "objectionRuling":
          next.objections = [...prev.objections, event.event];
          break;
        case "metricsUpdate":
          next.metrics = event.metrics;
          if (event.methodology) next.confidenceMethodology = event.methodology;
          break;
        case "authorityCited":
          if (!prev.authorities.some((a) => a.id === event.authority.id)) {
            next.authorities = [...prev.authorities, event.authority];
          }
          break;
        case "exhibitUpdate":
          next.exhibits = prev.exhibits.map((e) =>
            e.id === event.exhibit.id ? event.exhibit : e,
          );
          break;
        case "phaseChange":
          next.phase = event.phase;
          break;
        case "judgmentReady":
          next.judgment = event.report;
          break;
        case "tick":
          next.elapsedSeconds = event.elapsedSeconds;
          break;
        case "paused":
          next.isPaused = event.paused;
          break;
        case "coverageUpdate":
          next.agenda = event.agenda;
          break;
        default:
          break;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const adapter = adapterRef.current;
    const unsub = adapter.subscribe(applyEvent);
    return () => {
      unsub();
      adapter.dispose();
    };
  }, [applyEvent]);

  useEffect(() => {
    if (courtroomSpeech.activeEntryId) {
      setSpeakingEntryId(courtroomSpeech.activeEntryId);
    }
  }, [courtroomSpeech.activeEntryId]);

  useEffect(() => {
    setPastRuns(listCourtroomRuns());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (state.phase === "judgment" && state.judgment) {
      setJudgmentRevealed(true);
    }
  }, [state.phase, state.judgment]);

  const persistCurrentRun = useCallback(
    (overrides?: {
      judgment?: JudgmentReport;
      actionPlan?: ProposedActionPlan | null;
      checkedActionIds?: string[];
    }) => {
      const id = runIdRef.current;
      const judgment = overrides?.judgment ?? state.judgment;
      if (!id || !judgment) return;
      const record = buildCourtroomRunRecord({
        id,
        config,
        exhibits: state.exhibits.length ? state.exhibits : config.exhibits,
        intake: intakeBundle,
        agents,
        judgment,
        actionPlan: overrides?.actionPlan !== undefined ? overrides.actionPlan : actionPlan,
        checkedActionIds: overrides?.checkedActionIds ?? checkedActionIds,
        transcript: transcriptRef.current,
        agenda: state.agenda,
      });
      setPastRuns(upsertCourtroomRun(record));
    },
    [
      config,
      state.exhibits,
      state.judgment,
      state.agenda,
      intakeBundle,
      agents,
      actionPlan,
      checkedActionIds,
    ],
  );

  useEffect(() => {
    if (
      runIdRef.current &&
      state.judgment &&
      (state.phase === "judgment" || state.phase === "deliberation")
    ) {
      persistCurrentRun({ judgment: state.judgment });
    }
  }, [state.judgment, state.phase, persistCurrentRun]);

  const fetchActionPlan = useCallback(
    async (judgment: NonNullable<CourtroomState["judgment"]>) => {
      actionsAbortRef.current?.abort();
      const controller = new AbortController();
      actionsAbortRef.current = controller;
      setActionPlanStatus("loading");
      try {
        const transcriptText = transcriptRef.current
          .map((t) => `${t.speaker}: ${t.text}`)
          .join("\n");
        const payload = buildActionsPayload({
          config,
          judgment,
          agenda: state.agenda,
          transcriptText,
        });
        const plan = await proposeCourtroomActions(payload);
        if (controller.signal.aborted) return;
        setActionPlan(plan);
        setActionPlanStatus("ready");
        const checked = loadActionChecklist();
        setCheckedActionIds(checked);
        persistCurrentRun({
          judgment,
          actionPlan: plan,
          checkedActionIds: checked,
        });
      } catch {
        if (controller.signal.aborted) return;
        setActionPlanStatus("error");
        setActionPlan(null);
        persistCurrentRun({ judgment, actionPlan: null });
      }
    },
    [config, state.agenda, persistCurrentRun],
  );

  useEffect(() => {
    if (state.phase === "judgment" && state.judgment && actionPlanStatus === "idle") {
      void fetchActionPlan(state.judgment);
    }
  }, [state.phase, state.judgment, actionPlanStatus, fetchActionPlan]);

  useEffect(() => {
    if (state.isPaused && phase === "hearing") {
      setMobileTab("transcript");
    }
  }, [state.isPaused, phase]);

  const handleToggleActionChecked = useCallback(
    (id: string) => {
      setCheckedActionIds((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        saveActionChecklist(next);
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!runIdRef.current || !state.judgment) return;
    if (actionPlanStatus !== "ready" && actionPlanStatus !== "error") return;
    persistCurrentRun({ checkedActionIds });
  }, [checkedActionIds, actionPlanStatus, persistCurrentRun, state.judgment]);

  const handleRetryActions = useCallback(() => {
    if (!state.judgment) return;
    void fetchActionPlan(state.judgment);
  }, [fetchActionPlan, state.judgment]);

  const handleCopyActionPlan = useCallback(async () => {
    if (!actionPlan) return;
    try {
      await navigator.clipboard.writeText(buildActionPlanMarkdown(actionPlan));
    } catch {
      /* ignore */
    }
  }, [actionPlan]);

  const handlePause = useCallback(() => {
    adapterRef.current.pause();
    if (courtroomSpeech.isSpeaking) {
      courtroomSpeech.pause();
    }
  }, [courtroomSpeech]);

  const handleResume = useCallback(() => {
    adapterRef.current.resume();
    if (courtroomSpeech.status === "paused") {
      courtroomSpeech.resume();
    } else if (
      adapterRef.current.isAwaitingSpeech() &&
      !courtroomSpeech.isSpeaking &&
      courtroomSpeech.status === "idle"
    ) {
      adapterRef.current.advanceScript();
    }
  }, [courtroomSpeech]);

  const handleListeningModeChange = useCallback((enabled: boolean) => {
    setListeningMode(enabled);
    adapterRef.current.setSpeechGated(enabled);
    if (!enabled) {
      courtroomSpeechRef.current.stop();
      resetLinePipeline();
      setCompletedLineIds(new Set());
      setSpeakingEntryId(null);
      setTypingEntryId(null);
      setTypingCharCount(0);
    }
  }, [resetLinePipeline]);

  const handleViewJudgment = useCallback(() => {
    setJudgmentRevealed(true);
    adapterRef.current.revealJudgment();
    setState(adapterRef.current.getState());
  }, []);

  const selectPreset = useCallback((presetId: string) => {
    const preset = getDemoPreset(presetId);
    if (!preset) return;
    setConfig({
      ...preset.config,
      presetId,
    });
    setIntakeBundle((prev) => ({
      ...prev,
      brief: preset.subtitle,
      facts: `Preset: ${preset.label}`,
    }));
  }, []);

  const resetSession = useCallback(() => {
    courtroomSpeechRef.current.stop();
    resetLinePipeline();
    adapterRef.current.dispose();
    adapterRef.current = createLlmCourtroomAdapter();
    adapterRef.current.setSpeechGated(true);
    adapterRef.current.subscribe(applyEvent);
    setState(adapterRef.current.getState());
    setConfig(DEFAULT_CONFIG);
    setIntakeBundle(createEmptyIntakeBundle());
    setAgents([]);
    setPrepPhase("setup");
    setPrepareOpen(false);
    setDisplayLanguage("en");
    setListeningMode(true);
    setJudgmentRevealed(false);
    actionsAbortRef.current?.abort();
    setActionPlanStatus("idle");
    setActionPlan(null);
    setCheckedActionIds([]);
    runIdRef.current = null;
    setReviewingRunId(null);
    setReviewingSavedAt(null);
    setSpeakingEntryId(null);
    setTypingEntryId(null);
    setTypingCharCount(0);
    setCompletedLineIds(new Set());
    pdfFilesRef.current.clear();
    setMobileTab("transcript");
    setPastRuns(listCourtroomRuns());
  }, [applyEvent, resetLinePipeline]);

  const openPastRun = useCallback(
    (run: CourtroomRunRecord) => {
      courtroomSpeechRef.current.stop();
      resetLinePipeline();
      adapterRef.current.dispose();
      adapterRef.current = createLlmCourtroomAdapter();
      adapterRef.current.setSpeechGated(true);
      adapterRef.current.subscribe(applyEvent);
      runIdRef.current = run.id;
      setReviewingRunId(run.id);
      setReviewingSavedAt(run.savedAt);
      setConfig({
        ...DEFAULT_CONFIG,
        matterTitle: run.config.matterTitle,
        matterType: run.config.matterType,
        petitionerName: run.config.petitionerName,
        respondentName: run.config.respondentName,
        presetId: run.config.presetId,
        exhibits: run.exhibits,
        intake: run.intake ?? undefined,
        agents: run.agents,
      });
      setIntakeBundle(run.intake ?? createEmptyIntakeBundle());
      setAgents(run.agents);
      setPrepPhase("setup");
      setPrepareOpen(false);
      setActionPlan(run.actionPlan);
      setActionPlanStatus(run.actionPlan ? "ready" : "idle");
      setCheckedActionIds(run.checkedActionIds ?? []);
      setJudgmentRevealed(true);
      setSpeakingEntryId(null);
      setTypingEntryId(null);
      setTypingCharCount(0);
      setCompletedLineIds(new Set());
      setState({
        phase: "judgment",
        activeSpeaker: null,
        judgeState: "ruling",
        timelineStep: "verdict",
        transcript: run.transcript ?? [],
        exhibits: run.exhibits ?? [],
        authorities: run.judgment.authorities ?? [],
        objections: [],
        metrics: run.judgment.confidence,
        elapsedSeconds: 0,
        isPaused: true,
        judgment: run.judgment,
        agenda: run.agenda,
      });
    },
    [applyEvent, resetLinePipeline],
  );

  useEffect(() => {
    if (!reviewingRunId || !state.judgment) return;
    const t = window.setTimeout(() => {
      document.getElementById("courtroom-judgment")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
    return () => window.clearTimeout(t);
  }, [reviewingRunId, state.judgment]);

  const handleDeletePastRun = useCallback((id: string) => {
    deleteCourtroomRun(id);
    setPastRuns(listCourtroomRuns());
    if (runIdRef.current === id) {
      runIdRef.current = null;
    }
    if (reviewingRunId === id) {
      setReviewingRunId(null);
      setReviewingSavedAt(null);
    }
  }, [reviewingRunId]);

  const buildAgents = useCallback(async () => {
    if (!config.matterTitle.trim() || !hasMinimumIntake(intakeBundle) || buildingAgents) return;
    setBuildingAgents(true);
    setPrepPhase("processing");
    setProcessingStep("extracting");

    try {
      const result = await processCaseIntake(
        config,
        intakeBundle,
        setProcessingStep,
        pdfFilesRef.current,
      );
      const refined = await refineAgentsWithLlm(config, result.bundle, result.agents);
      setIntakeBundle(result.bundle);
      setAgents(refined);
      setConfig((c) => ({
        ...c,
        intake: result.bundle,
        agents: refined,
      }));
      setPrepPhase("agentsReady");
    } finally {
      setBuildingAgents(false);
    }
  }, [config, intakeBundle, buildingAgents]);

  const startHearing = useCallback(() => {
    if (!config.matterTitle.trim() || prepPhase !== "agentsReady") return;
    resetLinePipeline();
    setCompletedLineIds(new Set());
    setSpeakingEntryId(null);
    setTypingEntryId(null);
    setTypingCharCount(0);
    setJudgmentRevealed(false);
    setActionPlanStatus("idle");
    setActionPlan(null);
    setCheckedActionIds([]);
    runIdRef.current = crypto.randomUUID();
    setReviewingRunId(null);
    setReviewingSavedAt(null);
    void courtroomSpeechRef.current.unlock();
    const sessionConfig: CourtroomSessionConfig = {
      ...config,
      intake: intakeBundle,
      agents,
    };
    adapterRef.current.setSpeechGated(listeningMode);
    adapterRef.current.start(sessionConfig);
    setState(adapterRef.current.getState());
  }, [config, intakeBundle, agents, prepPhase, listeningMode, resetLinePipeline]);

  const canBuildAgents =
    config.matterTitle.trim().length >= 3 && hasMinimumIntake(intakeBundle) && !buildingAgents;
  const canStart = prepPhase === "agentsReady" && agents.length === 3;

  const showHearing = phase === "hearing";
  const showDeliberation = phase === "deliberation" && !judgmentRevealed;
  const showJudgment =
    (phase === "judgment" || (phase === "deliberation" && judgmentRevealed)) && state.judgment;

  const mobileTabs: { id: MobileTab; label: string }[] = useMemo(
    () => [
      { id: "transcript", label: "Transcript" },
      { id: "exhibits", label: "Exhibits" },
      { id: "authorities", label: "Authorities" },
      { id: "metrics", label: "Metrics" },
    ],
    [],
  );

  const onPdfFile = useCallback((artifactId: string, file: File) => {
    pdfFilesRef.current.set(artifactId, file);
  }, []);

  const scrollToTranscript = useCallback(() => {
    document.getElementById("deliberation-transcript")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const isReviewMode = Boolean(reviewingRunId);

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-[1200px] space-y-5 pb-24 md:space-y-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 pb-24 md:space-y-6">
      <CourtroomHero
        phase={phase}
        matterTitle={config.matterTitle || undefined}
        matterType={config.matterType}
        petitionerName={config.petitionerName}
        respondentName={config.respondentName}
        elapsedSeconds={state.elapsedSeconds}
        reviewingSaved={isReviewMode}
      />

      {(phase === "setup" || phase === "processing" || phase === "agentsReady") && (
        <>
          <PrepareCasePanel
            open={prepareOpen}
            onOpenChange={setPrepareOpen}
            config={config}
            onChange={setConfig}
            onSelectPreset={selectPreset}
            intakeBundle={intakeBundle}
            onIntakeChange={setIntakeBundle}
            pdfFiles={pdfFilesRef.current}
            onPdfFile={onPdfFile}
            agents={agents}
            agentsLocked={prepPhase === "setup"}
            disabled={buildingAgents || prepPhase === "processing"}
          />

          {phase === "setup" && (
            <>
              <CourtroomEmptyState hasPastRuns={pastRuns.length > 0} />
              <PastSimulationsPanel
                runs={pastRuns}
                onOpen={openPastRun}
                onDelete={handleDeletePastRun}
              />
            </>
          )}

          {phase === "processing" && (
            <>
              <CaseAnalysisPipeline activeStep={processingStep} />
              <div className="grid gap-3 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-36 animate-pulse rounded-xl border border-black/[0.06] bg-white/40 dark:border-white/[0.08] dark:bg-white/[0.03]"
                  />
                ))}
              </div>
            </>
          )}

          {phase === "agentsReady" && agents.length > 0 && (
            <>
              {intakeBundle.indexingWarning && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-950/90 dark:text-amber-100/85">
                  {intakeBundle.indexingWarning}
                </div>
              )}
              <AgentForgePanel agents={agents} intakeSummary={intakeBundle.summary} />
            </>
          )}

          <div className="flex justify-center">
            <CourtroomControls
              phase={phase}
              isPaused={state.isPaused}
              canStart={canStart}
              canBuildAgents={canBuildAgents}
              onBuildAgents={buildAgents}
              onStart={startHearing}
              onPause={handlePause}
              onResume={handleResume}
              onEndArguments={() => adapterRef.current.endArguments()}
              onNewSession={resetSession}
            />
          </div>
        </>
      )}

      {showHearing && (
        <div className="flex flex-col gap-4">
          <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <HearingTimeline activeStep={state.timelineStep} />
            <div className="flex flex-wrap items-center gap-2">
              <CourtroomListeningToggle
                enabled={listeningMode}
                onChange={handleListeningModeChange}
              />
              <CourtroomLanguageToggle value={displayLanguage} onChange={setDisplayLanguage} />
              <HearingTimer elapsedSeconds={state.elapsedSeconds} isPaused={state.isPaused} />
              <CourtroomControls
                phase={phase}
                isPaused={state.isPaused}
                canStart={canStart}
                onStart={startHearing}
                onPause={handlePause}
                onResume={handleResume}
                onEndArguments={() => adapterRef.current.endArguments()}
                onNewSession={resetSession}
              />
            </div>
          </div>

          <HearingStage
            petitionerName={config.petitionerName}
            respondentName={config.respondentName}
            activeSpeaker={state.activeSpeaker}
            judgeState={state.judgeState}
            judgeNote={state.judgeNote}
            agents={agents}
            isThinking={state.isThinking}
            matterTitle={config.matterTitle}
            matterType={config.matterType}
          />

          <CoverageTracker agenda={state.agenda ?? []} />

          <div className="min-h-0 hidden gap-4 lg:grid lg:grid-cols-[1.45fr_1fr] lg:items-stretch">
            <HearingChat
              entries={visibleTranscript}
              language={displayLanguage}
              isPaused={state.isPaused}
              listeningMode={listeningMode}
              speakingEntryId={speakingEntryId ?? courtroomSpeech.activeEntryId}
              typingEntryId={listeningMode ? typingEntryId : null}
              typingCharCount={typingCharCount}
              isThinking={state.isThinking}
              viewMode={transcriptViewMode}
              onViewModeChange={setTranscriptViewMode}
            />
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
              <EvidencePanel exhibits={state.exhibits} />
              <CitationsPanel authorities={state.authorities} />
              <ValidationMeters
                metrics={state.metrics}
                methodology={state.confidenceMethodology}
              />
            </div>
          </div>

          <div className="min-h-0 lg:hidden">
            <div className="mb-3 flex shrink-0 gap-1 overflow-x-auto rounded-xl border border-black/[0.06] bg-white/55 p-1 dark:border-white/[0.08] dark:bg-white/[0.03]">
              {mobileTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMobileTab(tab.id)}
                  className={cn(
                    "flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-[11px] font-semibold",
                    mobileTab === tab.id
                      ? "bg-stone-700 text-stone-50 dark:bg-stone-200 dark:text-stone-900"
                      : "text-muted-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {mobileTab === "transcript" && (
              <HearingChat
                entries={visibleTranscript}
                language={displayLanguage}
                isPaused={state.isPaused}
                listeningMode={listeningMode}
                speakingEntryId={speakingEntryId ?? courtroomSpeech.activeEntryId}
                typingEntryId={listeningMode ? typingEntryId : null}
                typingCharCount={typingCharCount}
                isThinking={state.isThinking}
                className="max-h-[min(48vh,480px)]"
                viewMode={transcriptViewMode}
                onViewModeChange={setTranscriptViewMode}
              />
            )}
            {mobileTab === "exhibits" && <EvidencePanel exhibits={state.exhibits} />}
            {mobileTab === "authorities" && <CitationsPanel authorities={state.authorities} />}
            {mobileTab === "metrics" && (
              <ValidationMeters
                metrics={state.metrics}
                methodology={state.confidenceMethodology}
              />
            )}
          </div>

          <div className="shrink-0">
            <ObjectionBar
              objections={state.objections}
              disabled={state.isPaused || phase !== "hearing" || Boolean(state.isThinking)}
              onRaise={(type) => adapterRef.current.raiseObjection(type)}
            />
          </div>
        </div>
      )}

      {showDeliberation && (
        <>
          <div className="flex justify-end">
            <CourtroomControls
              phase={phase}
              isPaused={false}
              canStart={false}
              judgmentReady={Boolean(state.judgment)}
              judgmentRevealed={judgmentRevealed}
              onViewJudgment={handleViewJudgment}
              onStart={startHearing}
              onPause={handlePause}
              onResume={handleResume}
              onEndArguments={() => {}}
              onNewSession={resetSession}
            />
          </div>
          <DeliberationScreen
            petitionerName={config.petitionerName}
            respondentName={config.respondentName}
            agents={agents}
            state={state}
            displayLanguage={displayLanguage}
            judgmentReady={Boolean(state.judgment)}
            onViewJudgment={handleViewJudgment}
            onReviewTranscript={scrollToTranscript}
          />
        </>
      )}

      {showJudgment && state.judgment && (
        <JudgmentScreen
          report={state.judgment}
          onDownload={() => {
            void import("@/components/courtroom/judgment-screen").then((m) =>
              m.downloadJudgmentReport(state.judgment!, actionPlan),
            );
          }}
          onDownloadJson={() => {
            void import("@/components/courtroom/judgment-screen").then((m) =>
              m.downloadJudgmentJson(state.judgment!),
            );
          }}
          onNewSession={resetSession}
          showBilingual={displayLanguage !== "en"}
          actionPlanStatus={actionPlanStatus}
          actionPlan={actionPlan}
          checkedActionIds={checkedActionIds}
          onToggleActionChecked={handleToggleActionChecked}
          onRetryActions={handleRetryActions}
          onCopyActionPlan={handleCopyActionPlan}
          isReviewMode={isReviewMode}
          savedAt={reviewingSavedAt}
        />
      )}
    </div>
  );
}
