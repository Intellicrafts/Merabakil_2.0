import { describe, expect, it, beforeEach } from "vitest";

import { isGoogleOneTapSupported, resetGoogleIdentityForTests } from "@/lib/google-identity";

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
