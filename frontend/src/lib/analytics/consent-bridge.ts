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

/** Initialize Consent Mode v2 defaults (must run before GA script). */
export function initConsentModeDefaults() {
  if (typeof window === "undefined") return;
  gtag("consent", "default", {
    analytics_storage: "denied" as GtagConsent,
    ad_storage: "denied" as GtagConsent,
    ad_user_data: "denied" as GtagConsent,
    ad_personalization: "denied" as GtagConsent,
    functionality_storage: "granted" as GtagConsent,
    security_storage: "granted" as GtagConsent,
    wait_for_update: 500,
  });
}

export function updateConsentMode(analyticsGranted: boolean) {
  if (typeof window === "undefined") return;
  const state: GtagConsent = analyticsGranted ? "granted" : "denied";
  gtag("consent", "update", {
    analytics_storage: state,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}
