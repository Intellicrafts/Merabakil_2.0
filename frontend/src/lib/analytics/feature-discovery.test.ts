import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnalyticsEvents } from "@/lib/analytics/events";
import { trackFeatureDiscovery } from "@/lib/analytics/feature-discovery";

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

describe("trackFeatureDiscovery", () => {
  beforeEach(() => {
    mockSessionStorage();
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
