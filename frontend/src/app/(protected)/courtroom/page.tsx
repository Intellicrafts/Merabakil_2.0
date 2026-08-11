"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AgentForgePanel } from "@/components/courtroom/agent-forge-panel";
import { CaseAnalysisPipeline } from "@/components/courtroom/case-analysis-pipeline";
import { CourtroomControls } from "@/components/courtroom/courtroom-controls";
import { CourtroomEmptyState } from "@/components/courtroom/courtroom-empty-state";
import { CourtroomHero } from "@/components/courtroom/courtroom-hero";
import { CourtroomLanguageToggle } from "@/components/courtroom/courtroom-language-toggle";
import { CourtroomListeningToggle } from "@/components/courtroom/courtroom-listening-toggle";
import { DeliberationScreen } from "@/components/courtroom/deliberation-screen";
import { PrepareCasePanel } from "@/components/courtroom/prepare-case-panel";
import { CitationsPanel } from "@/components/courtroom/citations-panel";
import { EvidencePanel } from "@/components/courtroom/evidence-panel";
import { HearingTimeline } from "@/components/courtroom/hearing-timeline";
import { HearingTimer } from "@/components/courtroom/hearing-timer";
import {
  JudgmentScreen,
  downloadJudgmentJson,
  downloadJudgmentReport,
} from "@/components/courtroom/judgment-screen";
import { CoverageTracker } from "@/components/courtroom/coverage-tracker";
import { HearingChat } from "@/components/courtroom/hearing-chat";
import { HearingStage } from "@/components/courtroom/hearing-stage";
import { ObjectionBar } from "@/components/courtroom/objection-bar";
import { ValidationMeters } from "@/components/courtroom/validation-meters";
import { useCourtroomSpeech } from "@/hooks/use-courtroom-speech";
import {
  useHearingLinePipeline,
  useHearingTranscriptWatcher,
} from "@/hooks/use-hearing-line-pipeline";
import { createEmptyIntakeBundle, hasMinimumIntake } from "@/lib/courtroom/case-bundle";
import { getDemoPreset } from "@/lib/courtroom/demo-sessions";
import { processCaseIntake } from "@/lib/courtroom/intake-processor";
import { createLlmCourtroomAdapter } from "@/lib/courtroom/llm-adapter";
import { refineAgentsWithLlm } from "@/lib/courtroom/llm-courtroom";
import type {
  AgentPersona,
  CaseIntakeBundle,
  CourtroomEvent,
  CourtroomPhase,
  CourtroomSessionConfig,
  CourtroomState,
  ProcessingStep,
  TranscriptEntry,
  TranscriptLanguage,
} from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

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
    if (state.isPaused && phase === "hearing") {
      setMobileTab("transcript");
    }
  }, [state.isPaused, phase]);

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
    setSpeakingEntryId(null);
    setTypingEntryId(null);
    setTypingCharCount(0);
    setCompletedLineIds(new Set());
    pdfFilesRef.current.clear();
    setMobileTab("transcript");
  }, [applyEvent, resetLinePipeline]);

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

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 pb-24 md:space-y-6">
      <CourtroomHero
        phase={phase}
        matterTitle={config.matterTitle || undefined}
        elapsedSeconds={state.elapsedSeconds}
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

          {phase === "setup" && <CourtroomEmptyState />}

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
            <AgentForgePanel agents={agents} intakeSummary={intakeBundle.summary} />
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
            />
            <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
              <EvidencePanel exhibits={state.exhibits} />
              <CitationsPanel authorities={state.authorities} />
              <ValidationMeters metrics={state.metrics} />
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
              />
            )}
            {mobileTab === "exhibits" && <EvidencePanel exhibits={state.exhibits} />}
            {mobileTab === "authorities" && <CitationsPanel authorities={state.authorities} />}
            {mobileTab === "metrics" && <ValidationMeters metrics={state.metrics} />}
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
          onDownload={() => downloadJudgmentReport(state.judgment!)}
          onDownloadJson={() => downloadJudgmentJson(state.judgment!)}
          onNewSession={resetSession}
          showBilingual={displayLanguage !== "en"}
        />
      )}
    </div>
  );
}
