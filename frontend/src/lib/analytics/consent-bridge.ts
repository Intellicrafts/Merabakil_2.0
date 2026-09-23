type GtagConsent = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function gtag(...args: unknown[]) {
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(args);
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
