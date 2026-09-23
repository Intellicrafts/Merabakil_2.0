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

const MERA_VAKIL_VOICE_KEY = "legalos.meravakil.voice";

export function setMeraVakilVoiceOpen(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MERA_VAKIL_VOICE_KEY, "1");
}

export function consumeMeraVakilVoiceOpen(): boolean {
  if (typeof window === "undefined") return false;
  const v = sessionStorage.getItem(MERA_VAKIL_VOICE_KEY);
  if (v) sessionStorage.removeItem(MERA_VAKIL_VOICE_KEY);
  return v === "1";
}

const MERA_VAKIL_AUTOSEND_KEY = "legalos.meravakil.autosend";

/**
 * Marks the prefilled question to be auto-sent on Saarthi load — set by /ask so
 * the visitor's question is answered immediately after signing in, no retyping.
 * The question itself rides along in the prefill; if the send fails it stays in
 * the composer/thread so it isn't lost.
 */
export function setMeraVakilAutoSend(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MERA_VAKIL_AUTOSEND_KEY, "1");
}

export function consumeMeraVakilAutoSend(): boolean {
  if (typeof window === "undefined") return false;
  const v = sessionStorage.getItem(MERA_VAKIL_AUTOSEND_KEY);
  if (v) sessionStorage.removeItem(MERA_VAKIL_AUTOSEND_KEY);
  return v === "1";
}
