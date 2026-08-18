import { streamResearch } from "@/lib/api";
import { generateAgentPersonas } from "@/lib/courtroom/agent-profiles";
import type { AgentPersona, CaseIntakeBundle, CourtroomSessionConfig } from "@/lib/courtroom/types";

function parseStrategyBullets(raw: string, roleKey: string): string[] {
  const lower = raw.toLowerCase();
  const idx = lower.indexOf(roleKey.toLowerCase());
  if (idx < 0) return [];
  const slice = raw.slice(idx, idx + 600);
  const bullets = slice
    .split(/\n|•|- /)
    .map((s) => s.replace(/^[\d.)\s]+/, "").trim())
    .filter((s) => s.length >= 12 && s.length < 180 && !/^judge|petitioner|respondent/i.test(s))
    .slice(0, 4);
  return bullets;
}

/** Optional LLM refinement — merges strategy bullets into template personas. */
export async function refineAgentsWithLlm(
  config: CourtroomSessionConfig,
  bundle: CaseIntakeBundle,
  baseAgents: AgentPersona[],
): Promise<AgentPersona[]> {
  try {
    const query = `Return JSON only for Indian courtroom simulation personas in a ${config.matterType} matter.
Case: ${bundle.summary.slice(0, 400)}

{
  "judge": { "tone": "short tone", "strategy": ["bullet1", "bullet2", "bullet3"] },
  "petitioner": { "tone": "short tone", "strategy": ["bullet1", "bullet2", "bullet3"] },
  "respondent": { "tone": "short tone", "strategy": ["bullet1", "bullet2", "bullet3"] }
}`;
    let raw = "";
    const result = await streamResearch(query, undefined, [], {
      onToken: (t) => {
        raw += t;
      },
    });
    const text = raw || result.answer || "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(text.slice(start, end + 1)) as Record<
        string,
        { tone?: string; strategy?: string[] }
      >;
      return baseAgents.map((agent) => {
        const key =
          agent.role === "judge"
            ? "judge"
            : agent.role === "petitioner_advocate"
              ? "petitioner"
              : "respondent";
        const block = parsed[key];
        if (!block) return agent;
        const strategy =
          Array.isArray(block.strategy) && block.strategy.length
            ? block.strategy.map(String).slice(0, 5)
            : agent.strategy;
        return {
          ...agent,
          tone: block.tone?.trim() || agent.tone,
          strategy,
        };
      });
    }

    // Soft fallback: pull bullets from plain text if JSON failed
    return baseAgents.map((agent) => {
      const key =
        agent.role === "judge"
          ? "judge"
          : agent.role === "petitioner_advocate"
            ? "petitioner"
            : "respondent";
      const bullets = parseStrategyBullets(text, key);
      return bullets.length ? { ...agent, strategy: bullets } : agent;
    });
  } catch {
    return generateAgentPersonas(config, bundle);
  }
}
