import type {
  AgentPersona,
  CaseIntakeBundle,
  CourtroomSessionConfig,
} from "@/lib/courtroom/types";

const MATTER_STRATEGIES: Record<string, { pet: string[]; res: string[] }> = {
  Commercial: {
    pet: ["Emphasize breach chronology", "Quantify damages from SLA data", "Press specific performance"],
    res: ["Invoke force majeure", "Challenge causation of loss", "Highlight cure-period compliance"],
  },
  Constitutional: {
    pet: ["Anchor on Article 21 liberty", "Challenge procedural fairness", "Cite Maneka Gandhi standards"],
    res: ["Defend statutory framework", "Show advisory-board compliance", "Limit relief to record"],
  },
  Civil: {
    pet: ["Establish cause of action", "Corroborate with documentary proof", "Seek interim protection"],
    res: ["Deny material allegations", "Raise limitation and laches", "Offer alternate facts"],
  },
  Criminal: {
    pet: ["Stress burden of proof", "Highlight evidentiary gaps", "Pray for bail or discharge"],
    res: ["Defend investigation integrity", "Oppose bail on gravity", "Cite precedents on custody"],
  },
  Arbitration: {
    pet: ["Invoke arbitration clause", "Seek interim measures", "Challenge seat/jurisdiction if needed"],
    res: ["Defend tribunal competence", "Oppose unconscional relief", "Press contractual estoppel"],
  },
};

export function generateAgentPersonas(
  config: CourtroomSessionConfig,
  intake?: CaseIntakeBundle,
): AgentPersona[] {
  const strategies = MATTER_STRATEGIES[config.matterType] ?? MATTER_STRATEGIES.Civil;
  const briefSnippet = intake?.summary || intake?.brief?.slice(0, 80) || config.matterTitle;

  return [
    {
      id: "agent-judge",
      role: "judge",
      displayName: "Hon'ble AI Judge",
      title: "Presiding Bench — Indian Court Simulation",
      tone: "Measured, Socratic, impartial; speaks as 'this Court'",
      traits: [
        "Frames issues like an Indian bench",
        "Pins counsel to the record",
        "Pronounces a clear operative order",
      ],
      strategy: [
        "Frame issues from intake summary",
        "Probe weak evidentiary links",
        `Apply ${config.matterType} standards on the pleaded record`,
      ],
      avatar: "judge",
    },
    {
      id: "agent-pet",
      role: "petitioner_advocate",
      displayName: config.petitionerName,
      title: "Advocate for the Petitioner / Applicant",
      tone: "Assertive, prayer-focused; addresses 'My Lords'",
      traits: ["Structured openings", "Citation-led arguments", "Emphasis on client harm"],
      strategy: [
        ...strategies.pet,
        `Ground case in: ${briefSnippet}`,
      ],
      avatar: "advocate",
    },
    {
      id: "agent-res",
      role: "respondent_advocate",
      displayName: config.respondentName,
      title: "Advocate for the Respondent / Opposite Party",
      tone: "Defensive, evidentiary challenge; addresses 'My Lords'",
      traits: ["Cross-examination style", "Record-bound responses", "Jurisdictional objections"],
      strategy: [
        ...strategies.res,
        "Challenge petitioner narrative from intake",
      ],
      avatar: "advocate",
    },
  ];
}

export function agentForSpeaker(
  agents: AgentPersona[] | undefined,
  role: "judge" | "petitioner" | "respondent",
): AgentPersona | undefined {
  if (!agents?.length) return undefined;
  if (role === "judge") return agents.find((a) => a.role === "judge");
  if (role === "petitioner") return agents.find((a) => a.role === "petitioner_advocate");
  return agents.find((a) => a.role === "respondent_advocate");
}
