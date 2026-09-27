import { UTM_PARAMS, UTM_STORAGE_KEY } from "@/lib/analytics/constants";
import type { AnalyticsParams } from "@/lib/analytics/params";
import { readConsent } from "@/lib/consent";

export type UtmParams = Partial<Record<(typeof UTM_PARAMS)[number], string>>;

/** Google Ads click id — kept first-party for its 90-day attribution window. */
const GCLID_STORAGE_KEY = "legalos.gclid";
const GCLID_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function adConsentDenied(): boolean {
  return readConsent()?.analytics === false;
}

function persistGclid(gclid: string): void {
  if (adConsentDenied()) return;
  try {
    window.localStorage.setItem(GCLID_STORAGE_KEY, JSON.stringify({ value: gclid, at: Date.now() }));
  } catch {
    /* storage disabled */
  }
}

/** Forget the stored click id (e.g. when the visitor chooses "Necessary only"). */
export function clearStoredGclid(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GCLID_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function persistedGclid(): string | undefined {
  try {
    const raw = window.localStorage.getItem(GCLID_STORAGE_KEY);
    if (!raw) return undefined;
    const { value, at } = JSON.parse(raw) as { value?: string; at?: number };
    if (!value || !at || Date.now() - at > GCLID_TTL_MS) {
      clearStoredGclid();
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

/** The click id inside Google's own `_gcl_aw` cookie ("GCL.<time>.<gclid>"). */
function gclidFromCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(/(?:^|;\s*)_gcl_aw=([^;]+)/);
  if (!match) return undefined;
  const parts = decodeURIComponent(match[1]).split(".");
  const value = parts.length >= 3 ? parts.slice(2).join(".") : "";
  return value && value.length <= 512 ? value : undefined;
}

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
    persistGclid(gclid);
    found = true;
  }

  if (!found) return null;

  // UTM tags are last-touch, but a later untagged-by-Ads visit must not erase
  // the click id captured earlier in the session.
  const previousGclid = (readStoredUtm() as Record<string, string | undefined>).gclid;
  const merged = { ...utm } as Record<string, string>;
  if (!merged.gclid && previousGclid) merged.gclid = previousGclid;

  try {
    window.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  return merged as UtmParams;
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

export type AcquisitionPayload = {
  gclid?: string;
  utm_source?: string;
  utm_campaign?: string;
};

/**
 * Ad attribution to persist on the user record at signup (source of truth for
 * Google Ads conversions). Returns undefined when nothing was captured.
 */
export function acquisitionPayload(): AcquisitionPayload | undefined {
  const utm = readStoredUtm() as Record<string, string | undefined>;
  const payload: AcquisitionPayload = {};
  // Click id: this session → the 90-day first-party copy → Google's _gcl_aw cookie.
  // Never sent for visitors who chose "Necessary only".
  const gclid = adConsentDenied() ? undefined : utm.gclid ?? persistedGclid() ?? gclidFromCookie();
  if (gclid) payload.gclid = gclid;
  if (utm.utm_source) payload.utm_source = utm.utm_source;
  if (utm.utm_campaign) payload.utm_campaign = utm.utm_campaign;
  return Object.keys(payload).length > 0 ? payload : undefined;
}
