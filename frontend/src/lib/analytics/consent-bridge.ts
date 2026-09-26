type GtagConsent = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * gtag.js only executes commands pushed as an `arguments` object — a plain
 * array is silently ignored (that previously made "Necessary only" a no-op).
 */
function gtag(..._args: unknown[]) {
  window.dataLayer = window.dataLayer ?? [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

/**
 * Opt-out model: a single choice governs measurement + advertising. "Accept
 * all" grants every signal (so Google Ads can set _gcl_aw and attribute
 * conversions); "Necessary only" denies them all.
 */
export function updateConsentMode(granted: boolean) {
  if (typeof window === "undefined") return;
  const state: GtagConsent = granted ? "granted" : "denied";
  gtag("consent", "update", {
    analytics_storage: state,
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
  });
}
