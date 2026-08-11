export type CourtroomPhase =
  | "setup"
  | "processing"
  | "agentsReady"
  | "hearing"
  | "deliberation"
  | "judgment";

export type SpeakerRole = "judge" | "petitioner" | "respondent" | "clerk";

export type JudgeState = "listening" | "questioning" | "deliberating" | "ruling";

export type HearingTimelineStep =
  | "opening"
  | "examination"
  | "objections"
  | "closing"
  | "deliberation";

export type ObjectionType = "relevance" | "hearsay" | "procedure";

export type ObjectionRuling = "sustained" | "overruled" | "pending";

export type TranscriptLanguage = "en" | "hi" | "both";

export type IntakeArtifactKind = "text" | "pdf" | "doc" | "photo" | "audio" | "video";

export interface CaseIntakeArtifact {
  id: string;
  kind: IntakeArtifactKind;
  name: string;
  sizeBytes?: number;
  previewUrl?: string;
  documentId?: string;
  status: "pending" | "processing" | "ready" | "failed";
  excerpt?: string;
}

export interface CaseIntakeBundle {
  brief: string;
  facts: string;
  issues: string;
  reliefSought: string;
  artifacts: CaseIntakeArtifact[];
  summary: string;
  processedAt?: string;
}

export type AgentRole = "judge" | "petitioner_advocate" | "respondent_advocate";

export interface AgentPersona {
  id: string;
  role: AgentRole;
  displayName: string;
  title: string;
  tone: string;
  traits: string[];
  strategy: string[];
  avatar: "judge" | "advocate";
}

export interface TranscriptEntry {
  id: string;
  speaker: string;
  role: SpeakerRole;
  text: string;
  textHi?: string;
  timestamp: number;
}

export interface Exhibit {
  id: string;
  title: string;
  type: string;
  status: "admitted" | "pending" | "marked";
  source?: string;
}

export interface LegalAuthority {
  id: string;
  marker: string;
  title: string;
  citation: string;
  citedBy?: SpeakerRole;
}

export interface ObjectionEvent {
  id: string;
  by: SpeakerRole;
  type: ObjectionType;
  ruling: ObjectionRuling;
  timestamp: number;
  note?: string;
}

export interface HearingMetrics {
  argumentStrength: number;
  evidenceSupport: number;
  proceduralCompliance: number;
}

export type AgendaPointStatus = "pending" | "raised" | "contested" | "resolved";

export interface HearingAgendaItem {
  id: string;
  label: string;
  source: "facts" | "issues" | "relief" | "exhibit" | "matter";
  status: AgendaPointStatus;
}

export interface HearingTurn {
  speaker: SpeakerRole;
  text: string;
  textHi?: string;
  addressesPointIds?: string[];
  cites?: string[];
  suggestJudgeIntervene?: boolean;
  timelineStep?: HearingTimelineStep;
  metricsDelta?: Partial<HearingMetrics>;
  judgeState?: JudgeState;
  judgeNote?: string;
}

export interface JudgmentReport {
  matterTitle: string;
  findingsOfFact: string[];
  findingsOfFactHi?: string[];
  legalReasoning: string;
  legalReasoningHi?: string;
  confidence: HearingMetrics;
  authorities: LegalAuthority[];
  nextSteps: string[];
  nextStepsHi?: string[];
  disposition: string;
  dispositionHi?: string;
  generatedAt: string;
  intakeSummary?: string;
  agentSummaries?: string[];
  timelineSteps?: HearingTimelineStep[];
  coverageSummary?: string;
  coveragePercent?: number;
  strongestPetitioner?: string[];
  strongestRespondent?: string[];
  weaknessesExposed?: string[];
}

export interface CourtroomSessionConfig {
  matterTitle: string;
  matterType: string;
  petitionerName: string;
  respondentName: string;
  presetId?: string;
  exhibits: Exhibit[];
  intake?: CaseIntakeBundle;
  agents?: AgentPersona[];
}

export interface CourtroomState {
  phase: CourtroomPhase;
  activeSpeaker: SpeakerRole | null;
  judgeState: JudgeState;
  timelineStep: HearingTimelineStep;
  transcript: TranscriptEntry[];
  exhibits: Exhibit[];
  authorities: LegalAuthority[];
  objections: ObjectionEvent[];
  metrics: HearingMetrics;
  judgeNote?: string;
  elapsedSeconds: number;
  isPaused: boolean;
  judgment: JudgmentReport | null;
  isThinking?: boolean;
  agenda?: HearingAgendaItem[];
}

export type CourtroomEvent =
  | { type: "transcript"; entry: TranscriptEntry }
  | { type: "speakerChange"; role: SpeakerRole | null }
  | { type: "thinking"; active: boolean }
  | { type: "timelineStep"; step: HearingTimelineStep }
  | { type: "judgeState"; state: JudgeState; note?: string }
  | { type: "objectionRuling"; event: ObjectionEvent }
  | { type: "metricsUpdate"; metrics: HearingMetrics }
  | { type: "authorityCited"; authority: LegalAuthority }
  | { type: "exhibitUpdate"; exhibit: Exhibit }
  | { type: "phaseChange"; phase: CourtroomPhase }
  | { type: "judgmentReady"; report: JudgmentReport }
  | { type: "tick"; elapsedSeconds: number }
  | { type: "paused"; paused: boolean }
  | { type: "coverageUpdate"; agenda: HearingAgendaItem[] };

export type CourtroomListener = (event: CourtroomEvent) => void;

export type ProcessingStep = "extracting" | "profiling" | "ready";
