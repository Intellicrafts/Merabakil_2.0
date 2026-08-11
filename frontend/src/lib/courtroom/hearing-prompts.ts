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
  judge: "Hon'ble Presiding Judge",
  petitioner: "Counsel for the Petitioner / Applicant",
  respondent: "Counsel for the Respondent / Opposite Party",
  clerk: "Court Master",
};

function matterForumHint(matterType: string): string {
  switch (matterType) {
    case "Criminal":
      return "Criminal side (CrPC / Indian Evidence Act framing). Address Prosecution vs Defence positions as Petitioner/Respondent labels in this sim.";
    case "Constitutional":
      return "Writ / constitutional jurisdiction (Articles, natural justice, proportionality).";
    case "Commercial":
      return "Commercial / contractual dispute (breach, damages, specific performance, CPC procedure).";
    case "Arbitration":
      return "Arbitration-related hearing (Arbitration & Conciliation Act — interim measures, seat, Section 34 style challenges).";
    default:
      return "Civil jurisdiction (CPC — pleadings, issues, evidence, relief).";
  }
}

function caseRecordBlock(config: CourtroomSessionConfig): string {
  const intake = config.intake;
  return [
    `Cause title: ${config.matterTitle}`,
    `Nature: ${config.matterType} — ${matterForumHint(config.matterType)}`,
    `Counsel: ${config.petitionerName} (for petitioner) vs ${config.respondentName} (for respondent)`,
    intake?.summary && `Case summary: ${intake.summary}`,
    intake?.brief && `Brief: ${intake.brief.slice(0, 700)}`,
    intake?.facts && `Facts pleaded: ${intake.facts.slice(0, 600)}`,
    intake?.issues && `Issues for consideration: ${intake.issues.slice(0, 500)}`,
    intake?.reliefSought && `Prayer / relief: ${intake.reliefSought}`,
    config.exhibits.length
      ? `Documents / exhibits marked: ${config.exhibits.map((e) => e.title).join("; ")}`
      : "Documents: as pleaded on the simulation record only",
  ]
    .filter(Boolean)
    .join("\n");
}

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

  const agendaLines = agenda
    .map((a) => `- [${a.id}] (${a.status}) ${a.label}`)
    .join("\n");

  const recent = transcript
    .slice(-8)
    .map((t) => `${t.speaker} (${t.role}): ${t.text}`)
    .join("\n");

  const phaseHint = forceClosing
    ? "This is CLOSING SUBMISSION. Sum up prayer / opposition. Do not open new factual issues. End with what order you seek."
    : intervene || role === "judge"
      ? "As the Bench: put a short Socratic question, frame/clarify an issue, or give a brief procedural direction (Indian courtroom manner — 'Counsel, confine to…'). Do NOT pronounce final disposal yet."
      : turnIndex <= 1
        ? "OPENING: appear, state the case theory, and the principal relief from the record."
        : "Advance arguments on uncovered issues; answer the last opposing point; cite only what is on this record.";

  return `You are inside an AI SIMULATION of an Indian court hearing (NOT a real court; educational case-strength analysis).
Speak ONLY as: ${ROLE_LABEL[role]}${persona ? ` — manner: ${persona.tone}` : ""}.
${persona?.strategy?.length ? `Strategy cues: ${persona.strategy.slice(0, 3).join("; ")}` : ""}

INDIAN COURTROOM RULES:
- Address the Bench as "My Lords" / "Your Lordship" (advocates); Bench addresses "Counsel".
- Argue strictly from the CASE RECORD below. Do NOT invent statutes, sections, exhibits, or facts not on record.
- Prefer Indian procedural idioms: pleadings, issues, prayer, interim relief, burden of proof, onus, record.
- One courtroom utterance only (2–5 sentences). Sound like a real Indian advocate / judge.
- Prefer addressing uncovered agenda points. Surface weak spots and stronger alternative arguments.
- ${phaseHint}
- Counter last opposing submission when relevant.
- This is NOT the final judgment stage unless you are later asked for a verdict.

CASE RECORD:
${caseRecordBlock(config)}

AGENDA / ISSUES UNDER DISCUSSION:
${agendaLines || "(none)"}

STILL TO BE COVERED:
${uncovered.map((u) => `- [${u.id}] ${u.label}`).join("\n") || "(largely contested)"}

RECENT TRANSCRIPT:
${recent || "(matter just called)"}

LAST OPPOSING LINE:
${lastOpposing ? `${lastOpposing.speaker}: ${lastOpposing.text}` : "(none)"}

Respond with ONLY valid JSON (no markdown, no ## headings, no code fences):
{
  "speaker": "${role}",
  "text": "English courtroom utterance",
  "textHi": "optional Hindi companion of same meaning",
  "addressesPointIds": ["pt-1"],
  "cites": ["optional short citation or exhibit name from record"],
  "suggestJudgeIntervene": false,
  "timelineStep": "opening|examination|objections|closing|verdict|deliberation",
  "metricsDelta": { "argumentStrength": 0.55, "evidenceSupport": 0.5, "proceduralCompliance": 0.85 },
  "judgeState": "listening|questioning|ruling|deliberating",
  "judgeNote": "optional short note if judge"
}`;
}

/** Oral pronouncement in open court — mandatory after arguments. */
export function buildVerdictPrompt(opts: {
  config: CourtroomSessionConfig;
  agenda: HearingAgendaItem[];
  transcript: TranscriptEntry[];
  agents?: AgentPersona[];
}): string {
  const { config, agenda, transcript, agents } = opts;
  const persona = agents?.find((a) => a.role === "judge");
  const lines = transcript
    .filter((t) => t.role !== "clerk")
    .slice(-20)
    .map((t) => `${t.speaker}: ${t.text}`)
    .join("\n");

  return `You are the Hon'ble Presiding Judge in an AI SIMULATION of an Indian court (not a real court).
${persona ? `Manner: ${persona.tone}.` : ""}

ARGUMENTS HAVE CONCLUDED. You must now PRONOUNCE the oral order / verdict in open court.

INDIAN JUDGMENT STYLE (oral operative portion):
1. Briefly note that you have heard both sides.
2. Frame the decisive issue(s) in one line.
3. State the holding (allowed / dismissed / partly allowed / remanded / interim granted-refused) with short reasons tied ONLY to the case record.
4. End with a clear OPERATIVE PORTION: what is ordered today.

RULES:
- Speak ONLY as the Judge (first person plural "We" / "This Court" is fine).
- 4–8 sentences. No markdown. No JSON commentary outside the schema.
- Do NOT invent facts, exhibits, or statutes absent from the record below.
- Disposition must be decisive — do not "reserve indefinitely" without an interim direction.

CASE RECORD:
${caseRecordBlock(config)}

ISSUES / AGENDA:
${agenda.map((a) => `- [${a.id}] ${a.status}: ${a.label}`).join("\n")}

HEARING EXCERPT:
${lines || "(thin record — decide on pleadings as summarised)"}

Respond with ONLY valid JSON:
{
  "speaker": "judge",
  "text": "Oral pronouncement in English ending with clear operative order",
  "textHi": "optional Hindi companion",
  "addressesPointIds": [],
  "cites": [],
  "suggestJudgeIntervene": false,
  "timelineStep": "verdict",
  "judgeState": "ruling",
  "judgeNote": "Operative order pronounced",
  "metricsDelta": { "proceduralCompliance": 0.9 }
}`;
}

export function buildJudgmentPrompt(opts: {
  config: CourtroomSessionConfig;
  agenda: HearingAgendaItem[];
  transcript: TranscriptEntry[];
  coveragePercent: number;
  oralVerdict?: string;
}): string {
  const { config, agenda, transcript, coveragePercent: pct, oralVerdict } = opts;
  const lines = transcript
    .filter((t) => t.role !== "clerk")
    .map((t) => `${t.speaker}: ${t.text}`)
    .join("\n");

  return `You are drafting a SIMULATED written order / judgment for an Indian court hearing (educational; not binding).
Matter: ${config.matterTitle} (${config.matterType} — ${matterForumHint(config.matterType)})
Agenda coverage during hearing: ${pct}%
${oralVerdict ? `Oral pronouncement already made in open court:\n${oralVerdict}\n` : ""}

Structure the written order in Indian style:
- Issues framed
- Findings of fact (from the simulated record)
- Legal reasoning / ratio (brief)
- Operative portion (must align with the oral verdict if given)
- Practical next steps for counsel to strengthen the real case

Agenda:
${agenda.map((a) => `- [${a.id}] ${a.status}: ${a.label}`).join("\n")}

Full hearing transcript:
${lines.slice(0, 6000)}

Return ONLY JSON (no markdown fences):
{
  "issuesFramed": ["Issue 1: ...", "Issue 2: ..."],
  "findingsOfFact": ["..."],
  "findingsOfFactHi": ["..."],
  "legalReasoning": "...",
  "legalReasoningHi": "...",
  "disposition": "Operative portion — e.g. Petition partly allowed; parties to ...",
  "dispositionHi": "...",
  "oralVerdict": "Short restatement of the oral order",
  "oralVerdictHi": "...",
  "nextSteps": ["how to strengthen petitioner case", "..."],
  "nextStepsHi": ["..."],
  "strongestPetitioner": ["..."],
  "strongestRespondent": ["..."],
  "weaknessesExposed": ["..."],
  "coverageSummary": "one paragraph on what was argued and what remains"
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
    const text =
      cleaned.replace(/\s+/g, " ").slice(0, 500) ||
      (fallbackRole === "judge"
        ? "This Court has heard counsel. On the present simulation record, the matter is disposed in terms of the operative directions that follow."
        : "My Lords, I rely on the pleadings and the record as placed.");
    return {
      speaker: fallbackRole,
      text,
      addressesPointIds: [],
      suggestJudgeIntervene: false,
      timelineStep: fallbackRole === "judge" ? "verdict" : "examination",
      judgeState: fallbackRole === "judge" ? "ruling" : undefined,
    };
  }
}

export function parseJudgmentJson(raw: string): Partial<{
  issuesFramed: string[];
  findingsOfFact: string[];
  findingsOfFactHi: string[];
  legalReasoning: string;
  legalReasoningHi: string;
  disposition: string;
  dispositionHi: string;
  oralVerdict: string;
  oralVerdictHi: string;
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
      disposition:
        "Simulated — on the hearing record, the Court disposes the matter with liberty to parties to strengthen pleadings and evidence.",
      nextSteps: ["Revisit uncovered agenda points and shore up documentary proof."],
    };
  }
}
