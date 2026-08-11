const HISTORY_KEY = "legalos.research.history";
const MAX_HISTORY = 8;

export function loadResearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed.filter((q) => typeof q === "string") : [];
  } catch {
    return [];
  }
}

export function saveResearchHistory(query: string): string[] {
  const next = [query, ...loadResearchHistory().filter((q) => q !== query)].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export const RESEARCH_STARTER_PROMPTS = [
  "What are the essentials of a valid contract under Indian law?",
  "Explain Article 21 of the Constitution of India.",
  "How does the Limitation Act affect civil suits in India?",
] as const;
