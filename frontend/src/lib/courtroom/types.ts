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
  | "verdict"
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
  /** Issues framed for decision (Indian judgment style). */
  issuesFramed?: string[];
  findingsOfFact: string[];
  findingsOfFactHi?: string[];
  legalReasoning: string;
  legalReasoningHi?: string;
  confidence: HearingMetrics;
  authorities: LegalAuthority[];
  nextSteps: string[];
  nextStepsHi?: string[];
  /** Operative portion / final order (what the Court holds). */
  disposition: string;
  dispositionHi?: string;
  /** Oral verdict line as pronounced in open court. */
  oralVerdict?: string;
  oralVerdictHi?: string;
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

export type ActionPriority = "critical" | "high" | "medium" | "low";
export type ActionTimeframe = "immediate" | "7d" | "30d" | "before_next_listing";
export type ActionCategory =
  | "evidence"
  | "filing"
  | "research"
  | "settlement"
  | "compliance"
  | "procedure"
  | "defense"
  | "fact_proof";
export type ActionSide = "petitioner" | "respondent" | "both";
export type ActionCtaKind = "research" | "mera_vakil" | "copy";
export type ActionPlanStatus = "idle" | "loading" | "ready" | "error";

export interface ProposedActionCta {
  kind: ActionCtaKind;
  query?: string | null;
}

export interface ProposedAction {
  id: string;
  title: string;
  description: string;
  side: ActionSide;
  priority: ActionPriority;
  timeframe: ActionTimeframe;
  category: ActionCategory;
  rationale: string;
  relatedIssueIds?: string[];
  cta?: ProposedActionCta | null;
}

export interface MandatoryFact {
  id: string;
  fact: string;
  whyMandatory: string;
  howToProve: string;
  side: ActionSide;
  relatedIssueIds?: string[];
}

export interface OpponentFactDefense {
  id: string;
  opponentFact: string;
  defenseStrategy: string;
  evidenceNeeded: string;
  side: ActionSide;
  relatedIssueIds?: string[];
}

export interface ResearchAngle {
  title: string;
  query: string;
}

export interface ProposedActionPlan {
  headline: string;
  summary: string;
  forumHint?: string | null;
  limitationFlags: string[];
  actions: ProposedAction[];
  /** Facts that must be established / proved. */
  mandatoryFacts: MandatoryFact[];
  /** How to defend / rebut facts advanced by the opposite side. */
  opponentFactDefenses: OpponentFactDefense[];
  documentsToGather: string[];
  researchAngles: ResearchAngle[];
  settlementLevers: string[];
  disclaimer: string;
}

export interface CourtroomActionsRequestPayload {
  matter_title: string;
  matter_type: string;
  petitioner_name: string;
  respondent_name: string;
  oral_verdict?: string | null;
  disposition?: string | null;
  issues_framed?: string[];
  weaknesses_exposed?: string[];
  coverage_summary?: string | null;
  agenda?: { id: string; label: string; status: string }[];
  transcript_excerpt?: string | null;
}

export interface CourtroomSessionSnapshot {
  savedAt: string;
  config: Pick<
    CourtroomSessionConfig,
    "matterTitle" | "matterType" | "petitionerName" | "respondentName"
  >;
  judgment: JudgmentReport;
  actionPlan: ProposedActionPlan | null;
  checkedActionIds: string[];
}

/** Locally persisted completed courtroom simulation (no binary uploads). */
export interface CourtroomRunRecord {
  id: string;
  savedAt: string;
  config: Pick<
    CourtroomSessionConfig,
    "matterTitle" | "matterType" | "petitionerName" | "respondentName" | "presetId"
  >;
  exhibits: Exhibit[];
  /** Intake text + artifact metadata/excerpts (previewUrl stripped). */
  intake: CaseIntakeBundle | null;
  agents: AgentPersona[];
  judgment: JudgmentReport;
  actionPlan: ProposedActionPlan | null;
  checkedActionIds: string[];
  /** Capped transcript for review. */
  transcript: TranscriptEntry[];
  agenda?: HearingAgendaItem[];
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
