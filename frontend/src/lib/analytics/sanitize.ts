import { ALLOWED_PARAM_KEYS, type AnalyticsParamValue, type AnalyticsParams } from "@/lib/analytics/params";
import { FORBIDDEN_PARAM_KEYS } from "@/lib/analytics/blocklist";

function isSafeValue(value: unknown): value is AnalyticsParamValue {
  if (typeof value === "boolean" || typeof value === "number") return true;
  if (typeof value === "string") {
    if (value.length > 100) return false;
    return true;
  }
  return false;
}

/** Strip forbidden/unknown keys and unsafe values before sending to GA4. */
export function sanitizeParams(params?: AnalyticsParams): AnalyticsParams | undefined {
  if (!params) return undefined;

  const clean: AnalyticsParams = {};
  let dropped = false;

  for (const [key, value] of Object.entries(params)) {
    if (FORBIDDEN_PARAM_KEYS.has(key)) {
      dropped = true;
      continue;
    }
    if (!ALLOWED_PARAM_KEYS.has(key)) {
      dropped = true;
      continue;
    }
    if (!isSafeValue(value)) {
      dropped = true;
      continue;
    }
    clean[key] = value;
  }

  if (dropped && process.env.NODE_ENV === "development") {
    console.warn("[analytics] Dropped unsafe or unknown params from event payload.");
  }

  return Object.keys(clean).length > 0 ? clean : undefined;
}
