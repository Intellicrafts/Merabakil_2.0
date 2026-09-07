const MERA_VAKIL_PREFILL_KEY = "legalos.meravakil.prefill";
const RESEARCH_PREFILL_KEY = "legalos.research.prefill";

export function setResearchPrefill(query: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RESEARCH_PREFILL_KEY, query);
}

export function consumeResearchPrefill(): string | null {
  if (typeof window === "undefined") return null;
  const q = sessionStorage.getItem(RESEARCH_PREFILL_KEY);
  if (q) sessionStorage.removeItem(RESEARCH_PREFILL_KEY);
  return q;
}

export function setMeraVakilPrefill(query: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MERA_VAKIL_PREFILL_KEY, query);
}

export function consumeMeraVakilPrefill(): string | null {
  if (typeof window === "undefined") return null;
  const q = sessionStorage.getItem(MERA_VAKIL_PREFILL_KEY);
  if (q) sessionStorage.removeItem(MERA_VAKIL_PREFILL_KEY);
  return q;
}
