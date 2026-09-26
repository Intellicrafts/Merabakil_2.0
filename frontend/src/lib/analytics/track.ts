import {
  CLARITY_UPGRADE_EVENTS,
  clarityEvent,
  clarityIdentify,
  claritySetTag,
  claritySetTagsFromParams,
  clarityUpgrade,
} from "@/lib/analytics/clarity";
import { GA_ENABLED, GA_MEASUREMENT_ID } from "@/lib/analytics/constants";
import { readConsent } from "@/lib/consent";
import type { AnalyticsEventName } from "@/lib/analytics/events";
import type { AnalyticsParams } from "@/lib/analytics/params";
import { sanitizeParams } from "@/lib/analytics/sanitize";
import { hashUserId } from "@/lib/analytics/user-id";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Opt-out model: measure unless the user explicitly chose "Necessary only".
 * New visitors (no stored choice) default to granted, matching gtag defaults.
 * Shared by both sinks — Clarity applies the same predicate in `clarityAllowed()`.
 */
function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics !== false;
}

/**
 * GA4 gate. Kept separate from Clarity's so that disabling one sink never silently
 * disables the other — a single gate short-circuiting on GA_ENABLED would kill Clarity
 * everywhere GA is off, including local dev.
 */
function canTrackGa(): boolean {
  if (!GA_ENABLED || !GA_MEASUREMENT_ID) return false;
  if (typeof window === "undefined") return false;
  return hasAnalyticsConsent();
}

function gtag(...args: unknown[]) {
  window.gtag?.(...args);
}

export function track(event: AnalyticsEventName, params?: AnalyticsParams): void {
  if (typeof window === "undefined") return;
  const safe = sanitizeParams(params);

  // Product events go to GA4 only; Google Ads must not count them as page views.
  if (canTrackGa()) gtag("event", event, { ...(safe ?? {}), send_to: GA_MEASUREMENT_ID });

  clarityEvent(event);
  claritySetTagsFromParams(safe);
  if (CLARITY_UPGRADE_EVENTS.has(event)) clarityUpgrade(event);
}

export function trackPageView(params: AnalyticsParams): void {
  if (typeof window === "undefined") return;
  const safe = sanitizeParams(params);

  // No send_to: page views reach every configured tag (GA4 + Google Ads remarketing).
  if (canTrackGa()) gtag("event", "page_view", safe);

  claritySetTagsFromParams(safe);
}

export async function setAnalyticsUser(userId: string, role?: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;
  const hashed = await hashUserId(userId);

  if (GA_ENABLED && GA_MEASUREMENT_ID) {
    gtag("config", GA_MEASUREMENT_ID, { user_id: hashed });
  }

  clarityIdentify(hashed, undefined, window.location.pathname, role);
  if (role) claritySetTag("user_role", role);
}

export type UserType = "guest" | "registered";

/** GA4 user property: set on load, on login/signup ("registered") and logout ("guest"). */
export function setUserType(type: UserType): void {
  if (!canTrackGa()) return;
  gtag("set", "user_properties", { user_type: type });
}

export function clearAnalyticsUser(): void {
  if (!GA_ENABLED || !GA_MEASUREMENT_ID || typeof window === "undefined") return;
  gtag("config", GA_MEASUREMENT_ID, { user_id: undefined });
}

/** Utility buckets — never pass raw counts that could identify users. */
export function bucketCount(count: number): string {
  if (count <= 0) return "0";
  if (count <= 5) return "1_5";
  if (count <= 20) return "6_20";
  return "over_20";
}

export function bucketLatency(ms: number): string {
  if (ms < 2000) return "under_2s";
  if (ms < 5000) return "2_5s";
  if (ms < 10000) return "5_10s";
  return "over_10s";
}

export function bucketFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return "under_1mb";
  if (mb < 5) return "1_5mb";
  if (mb < 10) return "5_10mb";
  return "over_10mb";
}

export function bucketAmount(amount: number): string {
  if (amount <= 0) return "zero";
  if (amount <= 100) return "under_100";
  if (amount <= 500) return "100_500";
  return "over_500";
}
