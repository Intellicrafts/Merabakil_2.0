/**
 * Which guest prompt opened the sign-up sheet ("text_limit" | "voice_limit" | "nudge").
 * Kept in sessionStorage so it survives the Google redirect and role onboarding,
 * and is attached as `source` to signup_started / signup_completed.
 */
export type SignupTrigger = "text_limit" | "voice_limit" | "nudge";

const KEY = "legalos.signup_source";

export function setSignupSource(trigger: SignupTrigger): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, trigger);
  } catch {
    /* storage disabled — attribution is best effort */
  }
}

export function getSignupSource(): SignupTrigger | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = window.sessionStorage.getItem(KEY);
    return value === "text_limit" || value === "voice_limit" || value === "nudge" ? value : undefined;
  } catch {
    return undefined;
  }
}

export function clearSignupSource(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** `{ source }` when a guest prompt started this sign-up, else nothing. */
export function signupSourceParam(): { source?: SignupTrigger } {
  const source = getSignupSource();
  return source ? { source } : {};
}
