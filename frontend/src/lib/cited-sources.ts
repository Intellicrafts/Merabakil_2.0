import type { ResearchResponse } from "@/lib/types";

type Cited<T> = { source: T; n: number };

/**
 * The sources an answer actually cites, each with its marker number ([KB-n] /
 * [WEB-n]). A chunk that was retrieved but not used is not a source of the
 * answer, so it is never listed as one.
 */
export function citedSources(
  research: Pick<ResearchResponse, "answer" | "sources" | "citations" | "web_sources">,
): { kb: Cited<ResearchResponse["sources"][number]>[]; web: Cited<ResearchResponse["web_sources"][number]>[] } {
  const answer = research.answer ?? "";
  const kbMarkers = new Set((research.citations ?? []).map((c) => c.marker));
  const kb = (research.sources ?? [])
    .map((source, i) => ({ source, n: i + 1 }))
    .filter(({ n }) => kbMarkers.has(`[KB-${n}]`) || answer.includes(`[KB-${n}]`));
  const web = (research.web_sources ?? [])
    .map((source, i) => ({ source, n: i + 1 }))
    .filter(({ n }) => answer.includes(`[WEB-${n}]`));
  return { kb, web };
}
