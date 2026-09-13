import { AnalyticsEvents } from "@/lib/analytics/events";
import { track } from "@/lib/analytics/track";

const SESSION_KEY = "legalos.features.discovered";

/** Major product areas — first visit per browser session only. */
const PAGE_TYPE_TO_FEATURE: Record<string, string> = {
  dashboard: "dashboard",
  ai_chat: "saarthi",
  marketplace: "lawyer_marketplace",
  appointments: "appointments",
  documents: "documents",
  wallet: "wallet",
  research: "research",
  cases: "cases",
  profile: "profile",
};

function readDiscovered(): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeDiscovered(features: Set<string>) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify([...features]));
}

/** Fire `feature_discovered` once per feature per session. */
export function trackFeatureDiscovery(pageType: string): void {
  const featureName = PAGE_TYPE_TO_FEATURE[pageType];
  if (!featureName) return;

  const discovered = readDiscovered();
  if (discovered.has(featureName)) return;

  discovered.add(featureName);
  writeDiscovered(discovered);
  track(AnalyticsEvents.FEATURE_DISCOVERED, { feature_name: featureName });
}
