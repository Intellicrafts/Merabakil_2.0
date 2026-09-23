import { CLARITY_ENABLED, CLARITY_PROJECT_ID } from "@/lib/analytics/constants";
import type { AnalyticsParams } from "@/lib/analytics/params";
import { readConsent } from "@/lib/consent";

/**
 * Microsoft Clarity client API wrapper.
 *
 * Clarity is the second analytics sink alongside GA4. Both are driven from the same
 * dispatcher in `track.ts`, so every instrumented event lands in both tools under the
 * same name and cross-references one-to-one.
 *
 * Consent model mirrors GA4's opt-out posture (DPDP Act, not GDPR): the tag loads on
 * every visit and runs in Clarity's cookieless no-consent mode until the user chooses.
 * `consentv2` carries the decision. An explicit "Necessary only" revokes and erases.
 */

type ClarityFn = ((...args: unknown[]) => unknown) & { q?: unknown[] };

declare global {
  interface Window {
    clarity?: ClarityFn;
  }
}

/**
 * Session-level dimensions promoted from event params to Clarity custom tags.
 *
 * Deliberately small: tags populate the Filters dropdown in the Clarity dashboard, so
 * high-cardinality keys (buckets, counts, ids) would make it unusable. Keys must exist
 * in ALLOWED_PARAM_KEYS — values reaching here are already scrubbed by sanitizeParams().
 */
export const CLARITY_TAG_KEYS = new Set([
  "page_type",
  "account_type",
  "cta_location",
  "cta_type",
  "booking_step",
  "booking_status",
  "consultation_mode",
  "matter_category",
  "practice_area_category",
  "signup_method",
  "authentication_method",
  "error_type",
  "feature_name",
  "utm_source",
  "utm_medium",
  "utm_campaign",
]);

/**
 * Events worth protecting from Clarity's daily sampling (100k recordings/project/day).
 * `upgrade` marks the session for retention so revenue and failure paths stay reviewable.
 */
export const CLARITY_UPGRADE_EVENTS = new Set([
  "appointment_started",
  "appointment_payment_started",
  "appointment_booked",
  "booking_abandoned",
  "error_page_viewed",
]);

/**
 * Installs the official queue stub so calls made before the tag script finishes loading
 * are buffered rather than dropped. The Clarity tag drains `window.clarity.q` on load.
 * Shape-identical to, and idempotent with, the vendor snippet's own `c[a]=c[a]||…`.
 */
function ensureQueue(): void {
  if (typeof window === "undefined") return;
  if (window.clarity) return;
  const stub: ClarityFn = function (...args: unknown[]) {
    (stub.q = stub.q ?? []).push(args);
  };
  stub.q = [];
  window.clarity = stub;
}

/**
 * Opt-out gate: collect unless the user has explicitly declined.
 *
 * Note this is `!== false`, not `=== true` as in `track.ts`'s GA gate. Under the
 * opt-out model an undecided visitor is still recorded — cookielessly, with a
 * per-pageview id — which is the whole point of loading the tag before the choice.
 */
function clarityAllowed(): boolean {
  if (!CLARITY_ENABLED || !CLARITY_PROJECT_ID) return false;
  if (typeof window === "undefined") return false;
  return readConsent()?.analytics !== false;
}

function call(...args: unknown[]): void {
  if (!clarityAllowed()) return;
  ensureQueue();
  try {
    window.clarity?.(...args);
  } catch {
    // Never let analytics break the page.
  }
}

/** Custom event — appears alongside Clarity's no-code Smart Events in every vertical. */
export function clarityEvent(name: string): void {
  call("event", name);
}

/** Custom tag — becomes a filter dimension on recordings, heatmaps and the dashboard. */
export function claritySetTag(key: string, value: string | number | boolean): void {
  call("set", key, String(value));
}

/** Promotes the allowlisted subset of an already-sanitized event payload to tags. */
export function claritySetTagsFromParams(params?: AnalyticsParams): void {
  if (!params) return;
  for (const [key, value] of Object.entries(params)) {
    if (CLARITY_TAG_KEYS.has(key)) claritySetTag(key, value);
  }
}

/**
 * Attach a stable identity to the session.
 *
 * `customId` must already be hashed — see hashUserId(). Clarity hashes it again on the
 * client, but we never hand it a raw identifier in the first place. `friendlyName` is
 * stored and displayed in plaintext on the Clarity dashboard, so it carries the user's
 * role ("citizen" / "advocate" / "admin"), never a name or email.
 */
export function clarityIdentify(
  customId: string,
  customSessionId?: string,
  customPageId?: string,
  friendlyName?: string,
): void {
  if (!customId) return;
  call("identify", customId, customSessionId, customPageId, friendlyName);
}

/**
 * Passes the consent decision.
 *
 * One banner choice governs measurement *and* advertising, matching
 * `updateConsentMode()` in consent-bridge.ts — "Accept all" grants both so Google Ads
 * can attribute conversions, "Necessary only" denies both. Keep the two in step: if the
 * gtag consent mapping ever splits these signals, split them here too.
 */
export function clarityConsent(granted: boolean): void {
  const state = granted ? "granted" : "denied";
  call("consentv2", { ad_Storage: state, analytics_Storage: state });
}

/**
 * Erases Clarity's cookies and halts tracking until consent is granted again.
 * Bypasses `clarityAllowed()` on purpose: by the time this runs the user has already
 * opted out, which is exactly the state the gate blocks on.
 */
export function clarityRevoke(): void {
  if (!CLARITY_ENABLED || !CLARITY_PROJECT_ID || typeof window === "undefined") return;
  ensureQueue();
  try {
    window.clarity?.("consent", false);
  } catch {
    // no-op
  }
}

/** Prioritises this session for retention under Clarity's daily sampling. */
export function clarityUpgrade(reason: string): void {
  call("upgrade", reason);
}
