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

function canTrack(): boolean {
  if (!GA_ENABLED || !GA_MEASUREMENT_ID) return false;
  if (typeof window === "undefined") return false;
  return readConsent()?.analytics === true;
}

function gtag(...args: unknown[]) {
  window.gtag?.(...args);
}

export function track(event: AnalyticsEventName, params?: AnalyticsParams): void {
  if (!canTrack()) return;
  const safe = sanitizeParams(params);
  gtag("event", event, safe);
}

export function trackPageView(params: AnalyticsParams): void {
  if (!canTrack()) return;
  const safe = sanitizeParams(params);
  gtag("event", "page_view", safe);
}

export async function setAnalyticsUser(userId: string): Promise<void> {
  if (!GA_ENABLED || !GA_MEASUREMENT_ID || typeof window === "undefined") return;
  if (readConsent()?.analytics !== true) return;
  const hashed = await hashUserId(userId);
  gtag("config", GA_MEASUREMENT_ID, { user_id: hashed });
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
