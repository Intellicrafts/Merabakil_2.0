/**
 * Bump whenever the disclosure changes materially — readConsent() returns null on a
 * version mismatch, which re-opens the banner for everyone.
 *
 * v3 covers two changes that landed together: optional cookies now include
 * advertising/measurement (Google Ads signals), and Microsoft Clarity adds session
 * recording + heatmaps. One bump re-collects consent for both.
 */
export const CONSENT_VERSION = 3;
export const CONSENT_STORAGE_KEY = "legalos.consent";

export type ConsentChoice = {
  version: number;
  analytics: boolean;
  acceptedAt: string;
};

export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentChoice;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(analytics: boolean): ConsentChoice {
  const choice: ConsentChoice = {
    version: CONSENT_VERSION,
    analytics,
    acceptedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(choice));
  window.dispatchEvent(new CustomEvent("legalos:consent-changed", { detail: choice }));
  return choice;
}

export function hasConsentChoice(): boolean {
  return readConsent() !== null;
}

/** Clears stored choice and re-opens the cookie banner. Revokes analytics immediately. */
export function clearConsent(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  window.dispatchEvent(
    new CustomEvent("legalos:consent-changed", { detail: { analytics: false } }),
  );
  window.dispatchEvent(new CustomEvent("legalos:consent-reset"));
}
