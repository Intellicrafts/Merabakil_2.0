import { afterEach, describe, expect, it } from "vitest";

import { updateConsentMode } from "@/lib/analytics/consent-bridge";
import { sanitizeParams } from "@/lib/analytics/sanitize";

describe("guest funnel analytics params", () => {
  it("keeps the guest/limit/voice keys that used to be stripped", () => {
    const out = sanitizeParams({
      is_guest: true,
      reason: "text",
      limit_type: "daily_messages",
      chats_used: 5,
      voice_seconds_used: 90,
      ended_by: "limit",
      duration_bucket: "90s_cap",
      trigger: "text_limit",
      source: "text_limit",
      method: "email",
      lang: "hi",
      length_bucket: "short",
    });
    expect(out).toMatchObject({ is_guest: true, reason: "text", chats_used: 5, trigger: "text_limit", method: "email" });
  });

  it("never lets chat or voice text through", () => {
    const out = sanitizeParams({
      question: "my landlord kept my deposit",
      query: "q",
      message: "m",
      text: "t",
      content: "c",
      transcript: "voice words",
      is_guest: true,
    });
    expect(out).toEqual({ is_guest: true });
  });
});

describe("consent bridge", () => {
  const g = globalThis as unknown as { window?: { dataLayer: unknown[] } };
  afterEach(() => {
    delete g.window;
  });

  it("pushes a real arguments object so gtag.js executes the update", () => {
    g.window = { dataLayer: [] }; // unit tests run in node — minimal window stand-in
    updateConsentMode(false);
    const entry = g.window.dataLayer[0] as IArguments;
    expect(Array.isArray(entry)).toBe(false);
    expect(Object.prototype.toString.call(entry)).toBe("[object Arguments]");
    expect(Array.from(entry).slice(0, 2)).toEqual(["consent", "update"]);
    expect((Array.from(entry)[2] as Record<string, string>).ad_storage).toBe("denied");
  });
});
