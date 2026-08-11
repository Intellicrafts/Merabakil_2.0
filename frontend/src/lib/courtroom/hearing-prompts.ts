import type {
  AgentPersona,
  CourtroomSessionConfig,
  HearingAgendaItem,
  HearingTurn,
  SpeakerRole,
  TranscriptEntry,
} from "@/lib/courtroom/types";
import { uncoveredPoints } from "@/lib/courtroom/hearing-agenda";

const ROLE_LABEL: Record<SpeakerRole, string> = {
  judge: "Hon'ble AI Judge",
  petitioner: "Petitioner Advocate",
  respondent: "Respondent Advocate",
  clerk: "Court Clerk",
};

export function buildTurnPrompt(opts: {
  config: CourtroomSessionConfig;
  role: Exclude<SpeakerRole, "clerk">;
  agenda: HearingAgendaItem[];
  transcript: TranscriptEntry[];
  agents?: AgentPersona[];
  turnIndex: number;
  forceClosing?: boolean;
  intervene?: boolean;
}): string {
  const { config, role, agenda, transcript, agents, turnIndex, forceClosing, intervene } = opts;
  const uncovered = uncoveredPoints(agenda);
  const lastOpposing = [...transcript]
    .reverse()
    .find((t) => t.role !== role && t.role !== "clerk");
  const persona = agents?.find((a) => {
    if (role === "judge") return a.role === "judge";
    if (role === "petitioner") return a.role === "petitioner_advocate";
    return a.role === "respondent_advocate";
  });

  const intake = config.intake;
  const caseRecord = [
    `Matter: ${config.matterTitle} (${config.matterType})`,
    intake?.summary && `Summary: ${intake.summary}`,
    intake?.brief && `Brief: ${intake.brief.slice(0, 600)}`,
    intake?.facts && `Facts: ${intake.facts.slice(0, 500)}`,
    intake?.issues && `Issues: ${intake.issues.slice(0, 400)}`,
    intake?.reliefSought && `Relief: ${intake.reliefSought}`,
    config.exhibits.length
      ? `Exhibits: ${config.exhibits.map((e) => e.title).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const agendaLines = agenda
    .map((a) => `- [${a.id}] (${a.status}) ${a.label}`)
    .join("\n");

  const recent = transcript
    .slice(-8)
    .map((t) => `${t.speaker} (${t.role}): ${t.text}`)
    .join("\n");

  const phaseHint = forceClosing
    ? "Deliver a CLOSING argument (or closing judicial note if judge). Do not open new issues."
    : intervene || role === "judge"
      ? "Ask a precise Socratic question or give a short procedural ruling. Pin counsel to the record."
      : turnIndex <= 1
        ? "OPENING: frame the strongest case theory from the record."
        : "COUNTER the last opposing submission; advance uncovered agenda points.";

  return `You are simulating an Indian courtroom hearing for case-strength analysis (NOT a real court).
Speak ONLY as: ${ROLE_LABEL[role]}${persona ? ` — tone: ${persona.tone}` : ""}.
${persona?.strategy?.length ? `Strategy cues: ${persona.strategy.slice(0, 3).join("; ")}` : ""}

RULES:
- Argue strictly from the case record below. Do NOT invent exhibits, statutes, or facts not on record.
- One courtroom utterance only (2–5 sentences). Sound like a real advocate / judge.
- Prefer addressing uncovered points. Surface weak spots and stronger alternative arguments.
- ${phaseHint}
- Counter last opposing point when relevant.

CASE RECORD:
${caseRecord}

AGENDA (cover these):
${agendaLines || "(none)"}

UNCOVERED NOW:
${uncovered.map((u) => `- [${u.id}] ${u.label}`).join("\n") || "(all contested)"}

RECENT TRANSCRIPT:
${recent || "(hearing just opened)"}

LAST OPPOSING LINE:
${lastOpposing ? `${lastOpposing.speaker}: ${lastOpposing.text}` : "(none)"}

Respond with ONLY valid JSON (no markdown fences):
{
  "speaker": "${role}",
  "text": "English courtroom utterance",
  "textHi": "optional Hindi companion of same meaning",
  "addressesPointIds": ["pt-1"],
  "cites": ["optional short citation or exhibit name from record"],
  "suggestJudgeIntervene": false,
  "timelineStep": "opening|examination|objections|closing|deliberation",
  "metricsDelta": { "argumentStrength": 0.55, "evidenceSupport": 0.5, "proceduralCompliance": 0.85 },
  "judgeState": "listening|questioning|ruling|deliberating",
  "judgeNote": "optional short note if judge"
}`;
}

export function buildJudgmentPrompt(opts: {
  config: CourtroomSessionConfig;
  agenda: HearingAgendaItem[];
  transcript: TranscriptEntry[];
  coveragePercent: number;
}): string {
  const { config, agenda, transcript, coveragePercent: pct } = opts;
  const lines = transcript
    .filter((t) => t.role !== "clerk")
    .map((t) => `${t.speaker}: ${t.text}`)
    .join("\n");

  return `You are drafting a SIMULATED judgment / hearing report for case-strength analysis (not binding).
Matter: ${config.matterTitle} (${config.matterType})
Coverage of agenda points: ${pct}%
Agenda:
${agenda.map((a) => `- [${a.id}] ${a.status}: ${a.label}`).join("\n")}

Full hearing transcript:
${lines.slice(0, 6000)}

Return ONLY JSON:
{
  "findingsOfFact": ["..."],
  "findingsOfFactHi": ["..."],
  "legalReasoning": "...",
  "legalReasoningHi": "...",
  "disposition": "Simulated — ...",
  "dispositionHi": "...",
  "nextSteps": ["how to strengthen petitioner case", "..."],
  "nextStepsHi": ["..."],
  "strongestPetitioner": ["..."],
  "strongestRespondent": ["..."],
  "weaknessesExposed": ["..."],
  "coverageSummary": "one paragraph on what was covered and what remains"
}`;
}

export function parseHearingTurn(raw: string, fallbackRole: SpeakerRole): HearingTurn {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const jsonSlice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;

  try {
    const parsed = JSON.parse(jsonSlice) as HearingTurn;
    if (!parsed.text || typeof parsed.text !== "string") throw new Error("missing text");
    return {
      speaker: (parsed.speaker as SpeakerRole) || fallbackRole,
      text: parsed.text.trim(),
      textHi: parsed.textHi?.trim(),
      addressesPointIds: parsed.addressesPointIds ?? [],
      cites: parsed.cites ?? [],
      suggestJudgeIntervene: Boolean(parsed.suggestJudgeIntervene),
      timelineStep: parsed.timelineStep,
      metricsDelta: parsed.metricsDelta,
      judgeState: parsed.judgeState,
      judgeNote: parsed.judgeNote,
    };
  } catch {
    const text = cleaned.replace(/\s+/g, " ").slice(0, 500) || "My Lords, I rely on the record as pleaded.";
    return {
      speaker: fallbackRole,
      text,
      addressesPointIds: [],
      suggestJudgeIntervene: false,
      timelineStep: "examination",
    };
  }
}

export function parseJudgmentJson(raw: string): Partial<{
  findingsOfFact: string[];
  findingsOfFactHi: string[];
  legalReasoning: string;
  legalReasoningHi: string;
  disposition: string;
  dispositionHi: string;
  nextSteps: string[];
  nextStepsHi: string[];
  strongestPetitioner: string[];
  strongestRespondent: string[];
  weaknessesExposed: string[];
  coverageSummary: string;
}> {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  try {
    return JSON.parse(start >= 0 ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    return {
      findingsOfFact: ["The simulated record was considered."],
      legalReasoning: cleaned.slice(0, 800) || "Reasoning unavailable.",
      disposition: "Simulated — matter reserved for further strengthening of pleadings",
      nextSteps: ["Revisit uncovered agenda points and shore up documentary proof."],
    };
  }
}
