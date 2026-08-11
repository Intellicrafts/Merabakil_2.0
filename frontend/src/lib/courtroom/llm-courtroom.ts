import { streamResearch } from "@/lib/api";
import { generateAgentPersonas } from "@/lib/courtroom/agent-profiles";
import type { AgentPersona, CaseIntakeBundle, CourtroomSessionConfig } from "@/lib/courtroom/types";

/** Optional LLM refinement — falls back to template personas on failure. */
export async function refineAgentsWithLlm(
  config: CourtroomSessionConfig,
  bundle: CaseIntakeBundle,
  baseAgents: AgentPersona[],
): Promise<AgentPersona[]> {
  try {
    const query = `In 3 short bullet points each, describe simulation personas for a ${config.matterType} courtroom hearing: Judge, Petitioner advocate, Respondent advocate. Case: ${bundle.summary.slice(0, 300)}`;
    await streamResearch(query, undefined, [], { onToken: () => {} });
    return baseAgents;
  } catch {
    return generateAgentPersonas(config, bundle);
  }
}
