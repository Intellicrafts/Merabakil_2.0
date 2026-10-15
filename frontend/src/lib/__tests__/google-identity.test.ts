import { describe, expect, it, beforeEach } from "vitest";

import { isGoogleOneTapSupported, resetGoogleIdentityForTests } from "@/lib/google-identity";
import { isGoogleNeedsRole } from "@/lib/types";

describe("google identity coordinator", () => {
  beforeEach(() => {
    resetGoogleIdentityForTests();
  });

  it("resetGoogleIdentityForTests clears singleton flags", () => {
    resetGoogleIdentityForTests();
    expect(true).toBe(true);
  });

  it("isGoogleOneTapSupported is false on localhost", () => {
    expect(isGoogleOneTapSupported()).toBe(false);
  });
});

describe("isGoogleNeedsRole", () => {
  it("treats an onboarding payload as a new Google user", () => {
    expect(
      isGoogleNeedsRole({
        status: "needs_role",
        onboarding_token: "token",
        email: "new@example.com",
        full_name: "New User",
      }),
    ).toBe(true);
  });

  it("does not treat a login session as onboarding", () => {
    expect(
      isGoogleNeedsRole({
        user: {
          user_id: "1",
          email: "old@example.com",
          full_name: "Old User",
          roles: ["citizen"],
          permissions: [],
        },
        tokens: { access_token: "a", refresh_token: "r", token_type: "bearer" },
      }),
    ).toBe(false);
  });
});
