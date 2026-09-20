import { UTM_PARAMS, UTM_STORAGE_KEY } from "@/lib/analytics/constants";
import type { AnalyticsParams } from "@/lib/analytics/params";

export type UtmParams = Partial<Record<(typeof UTM_PARAMS)[number], string>>;

export function captureUtmFromSearch(search: string): UtmParams | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(search);
  const utm: UtmParams = {};
  let found = false;

  for (const key of UTM_PARAMS) {
    const value = params.get(key);
    if (value && value.length <= 100) {
      utm[key] = value;
      found = true;
    }
  }

  // Capture Google Ads gclid for attribution
  const gclid = params.get("gclid");
  if (gclid && gclid.length <= 100) {
    (utm as Record<string, string>)["gclid"] = gclid;
    found = true;
  }

  if (!found) return null;

  try {
    window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utm));
  } catch {
    /* ignore */
  }
  return utm;
}

export function readStoredUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(UTM_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UtmParams;
  } catch {
    return {};
  }
}

export function utmAsAnalyticsParams(): AnalyticsParams {
  const utm = readStoredUtm();
  const out: AnalyticsParams = {};
  for (const [key, value] of Object.entries(utm)) {
    if (value) out[key] = value;
  }
  return out;
}
