import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { blockReasonFor } from "@/lib/analytics/question-funnel";
import { analyticsUrl } from "@/lib/analytics/track";
import { acquisitionPayload, captureUtmFromSearch, clearStoredGclid } from "@/lib/analytics/utm";
import { ChatStreamError, GuestLimitError } from "@/lib/api";
import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from "@/lib/consent";

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

const g = globalThis as unknown as { window?: unknown; document?: { cookie: string } };

describe("gclid attribution", () => {
  let local: MemoryStorage;
  let session: MemoryStorage;
  beforeEach(() => {
    local = new MemoryStorage();
    session = new MemoryStorage();
    g.window = { localStorage: local, sessionStorage: session };
    g.document = { cookie: "" };
  });
  afterEach(() => {
    delete g.window;
    delete g.document;
  });

  it("survives a later UTM-only visit in the same session", () => {
    captureUtmFromSearch("?gclid=CLICK123&utm_source=google");
    captureUtmFromSearch("?utm_source=newsletter");
    expect(acquisitionPayload()?.gclid).toBe("CLICK123");
    expect(acquisitionPayload()?.utm_source).toBe("newsletter");
  });

  it("survives a new tab / later visit for 90 days", () => {
    captureUtmFromSearch("?gclid=CLICK123");
    session.clear(); // new tab
    expect(acquisitionPayload()?.gclid).toBe("CLICK123");
    local.setItem("legalos.gclid", JSON.stringify({ value: "OLD", at: Date.now() - 91 * 864e5 }));
    expect(acquisitionPayload()).toBeUndefined(); // expired
  });

  it("falls back to Google's _gcl_aw cookie", () => {
    g.document!.cookie = "_ga=GA1.1.1; _gcl_aw=GCL.1790000000.COOKIECLICK";
    expect(acquisitionPayload()?.gclid).toBe("COOKIECLICK");
  });

  it("is neither stored nor sent for 'Necessary only' visitors", () => {
    local.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ analytics: false, version: CONSENT_VERSION }));
    captureUtmFromSearch("?gclid=CLICK123");
    expect(local.getItem("legalos.gclid")).toBeNull();
    expect(acquisitionPayload()?.gclid).toBeUndefined();
    clearStoredGclid();
  });
});

describe("question_blocked reasons", () => {
  it("maps each failure to a reason", () => {
    expect(blockReasonFor(new GuestLimitError(), true)).toEqual({ reason: "guest_limit" });
    expect(blockReasonFor(new ChatStreamError("insufficient_balance"), false)).toEqual({ reason: "wallet_empty" });
    expect(blockReasonFor(new ChatStreamError("rate_limited"), false)).toEqual({ reason: "rate_limit" });
    expect(blockReasonFor(new ChatStreamError("rate_limited"), true)).toEqual({ reason: "guest_limit" });
    expect(blockReasonFor(new ChatStreamError("network"), true)).toEqual({ reason: "error", errorCode: "network" });
  });
});

describe("page_location sent to GA4", () => {
  const origin = "https://merabakil.in";

  it("drops everything but attribution params", () => {
    expect(analyticsUrl("https://merabakil.in/mera-vakil?q=my%20landlord%20kept%20my%20deposit&utm_source=google&gclid=C1#c=x", origin))
      .toBe("https://merabakil.in/mera-vakil?utm_source=google&gclid=C1");
    expect(analyticsUrl("https://merabakil.in/research?q=divorce+papers", origin)).toBe("https://merabakil.in/research");
    expect(analyticsUrl("https://merabakil.in/mera-vakil?c=0f1e", origin)).toBe("https://merabakil.in/mera-vakil");
  });

  it("leaves other sites' referrers alone", () => {
    expect(analyticsUrl("https://www.google.com/", origin)).toBe("https://www.google.com/");
  });
});
