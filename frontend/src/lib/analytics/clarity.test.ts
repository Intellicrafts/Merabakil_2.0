import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_VERSION } from "@/lib/consent";

type ClarityStub = ((...args: unknown[]) => unknown) & { q?: unknown[] };

let calls: unknown[][];

/**
 * Installs a fake `window` with localStorage-backed consent. Pass `consent` as
 * undefined to model a visitor who has not answered the banner yet.
 *
 * `installTag` false leaves `window.clarity` unset, which is what the page looks like
 * before the Clarity script has finished loading.
 */
function setupWindow(consent?: boolean, { installTag = true } = {}) {
  const store = new Map<string, string>();
  if (consent !== undefined) {
    store.set(
      "legalos.consent",
      JSON.stringify({ version: CONSENT_VERSION, analytics: consent, acceptedAt: "2026-01-01" }),
    );
  }

  const win: Record<string, unknown> = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  if (installTag) {
    win.clarity = (...args: unknown[]) => {
      calls.push(args);
    };
  }

  vi.stubGlobal("window", win);
  return win;
}

/** Re-imports the module so module-level env constants are re-evaluated. */
async function loadClarity(enabled = "true", projectId = "test1234") {
  vi.stubEnv("NEXT_PUBLIC_CLARITY_ENABLED", enabled);
  vi.stubEnv("NEXT_PUBLIC_CLARITY_PROJECT_ID", projectId);
  vi.resetModules();
  return import("@/lib/analytics/clarity");
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("clarity gating", () => {
  it("is a no-op when the tag is disabled", async () => {
    setupWindow(true);
    const { clarityEvent } = await loadClarity("false");
    clarityEvent("login_completed");
    expect(calls).toHaveLength(0);
  });

  it("is a no-op when no project id is configured", async () => {
    setupWindow(true);
    const { clarityEvent } = await loadClarity("true", "");
    clarityEvent("login_completed");
    expect(calls).toHaveLength(0);
  });

  it("collects from an undecided visitor (opt-out model)", async () => {
    setupWindow(undefined);
    const { clarityEvent } = await loadClarity();
    clarityEvent("landing_page_viewed");
    expect(calls).toEqual([["event", "landing_page_viewed"]]);
  });

  it("stops collecting after an explicit opt-out", async () => {
    setupWindow(false);
    const { clarityEvent, claritySetTag } = await loadClarity();
    clarityEvent("landing_page_viewed");
    claritySetTag("page_type", "marketing_landing");
    expect(calls).toHaveLength(0);
  });
});

describe("clarity queueing", () => {
  it("buffers calls made before the tag script loads", async () => {
    const win = setupWindow(true, { installTag: false });
    const { clarityEvent } = await loadClarity();

    clarityEvent("login_started");
    clarityEvent("login_completed");

    // The real Clarity tag drains window.clarity.q on load.
    const stub = win.clarity as ClarityStub;
    expect(stub.q).toHaveLength(2);
    expect(stub.q?.[0]).toEqual(["event", "login_started"]);
  });
});

describe("clarity custom tags", () => {
  it("promotes only allowlisted keys and stringifies values", async () => {
    setupWindow(true);
    const { claritySetTagsFromParams } = await loadClarity();

    claritySetTagsFromParams({
      page_type: "booking",
      booking_step: 3,
      // Present in ALLOWED_PARAM_KEYS but too high-cardinality to be a filter.
      price_bucket: "over_500",
      duration_bucket: "under_2s",
    });

    expect(calls).toEqual([
      ["set", "page_type", "booking"],
      ["set", "booking_step", "3"],
    ]);
  });

  it("ignores an empty payload", async () => {
    setupWindow(true);
    const { claritySetTagsFromParams } = await loadClarity();
    claritySetTagsFromParams(undefined);
    expect(calls).toHaveLength(0);
  });
});

describe("clarity consent", () => {
  // One banner choice governs measurement and advertising, matching
  // updateConsentMode() in consent-bridge.ts. If those ever split, split these too.
  it("grants both signals on accept", async () => {
    setupWindow(true);
    const { clarityConsent } = await loadClarity();

    clarityConsent(true);
    expect(calls).toEqual([
      ["consentv2", { ad_Storage: "granted", analytics_Storage: "granted" }],
    ]);
  });

  it("denies both signals when consent is withheld", async () => {
    setupWindow(undefined);
    const { clarityConsent } = await loadClarity();

    clarityConsent(false);
    expect(calls).toEqual([
      ["consentv2", { ad_Storage: "denied", analytics_Storage: "denied" }],
    ]);
  });

  it("revokes even though the user has already opted out", async () => {
    // clarityAllowed() blocks on exactly this state, so revoke must bypass it —
    // otherwise "Necessary only" could never erase the cookies it is meant to clear.
    setupWindow(false);
    const { clarityRevoke } = await loadClarity();

    clarityRevoke();
    expect(calls).toEqual([["consent", false]]);
  });
});

describe("clarity identify", () => {
  it("skips an empty id rather than creating an anonymous identity", async () => {
    setupWindow(true);
    const { clarityIdentify } = await loadClarity();
    clarityIdentify("");
    expect(calls).toHaveLength(0);
  });

  it("passes the hashed id, page id and role", async () => {
    setupWindow(true);
    const { clarityIdentify } = await loadClarity();
    clarityIdentify("abc123hash", undefined, "/dashboard", "advocate");
    expect(calls).toEqual([["identify", "abc123hash", undefined, "/dashboard", "advocate"]]);
  });
});
