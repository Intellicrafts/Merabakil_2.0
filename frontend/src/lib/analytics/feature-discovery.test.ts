import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsEvents } from "@/lib/analytics/events";
import { trackFeatureDiscovery } from "@/lib/analytics/feature-discovery";
import { CONSENT_VERSION } from "@/lib/consent";

vi.mock("@/lib/analytics/track", () => ({
  track: vi.fn(),
}));

import { track } from "@/lib/analytics/track";

function mockSessionStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  });
}

/**
 * trackFeatureDiscovery() gates on readConsent(), which returns null when `window` is
 * undefined — so without this the tracking call is skipped and every assertion fails.
 */
function mockGrantedConsent() {
  const consent = JSON.stringify({
    version: CONSENT_VERSION,
    analytics: true,
    acceptedAt: "2026-01-01T00:00:00.000Z",
  });
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => (key === "legalos.consent" ? consent : null),
      setItem: () => {},
      removeItem: () => {},
    },
  });
}

describe("trackFeatureDiscovery", () => {
  beforeEach(() => {
    mockSessionStorage();
    mockGrantedConsent();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("fires once per feature per session", () => {
    trackFeatureDiscovery("dashboard");
    trackFeatureDiscovery("dashboard");

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith(AnalyticsEvents.FEATURE_DISCOVERED, {
      feature_name: "dashboard",
    });
  });

  it("ignores unmapped page types", () => {
    trackFeatureDiscovery("marketing_landing");
    expect(track).not.toHaveBeenCalled();
  });
});
