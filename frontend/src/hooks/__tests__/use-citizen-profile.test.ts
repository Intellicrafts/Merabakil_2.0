import { describe, expect, it } from "vitest";

import { profilesEqual } from "@/hooks/use-citizen-profile";
import type { CitizenProfileFormState } from "@/hooks/use-citizen-profile";

const BASE: CitizenProfileFormState = {
  full_name: "Aarav Mehta",
  email: "citizen@legalos.in",
  phone: "+91 98765 43210",
  date_of_birth: "",
  address: "New Delhi, India",
};

describe("profilesEqual", () => {
  it("returns true for identical trimmed values", () => {
    expect(profilesEqual(BASE, { ...BASE })).toBe(true);
  });

  it("detects dirty state when phone changes", () => {
    expect(
      profilesEqual(BASE, {
        ...BASE,
        phone: "+91 99999 99999",
      }),
    ).toBe(false);
  });

  it("treats whitespace-only differences as equal for optional fields", () => {
    expect(
      profilesEqual(BASE, {
        ...BASE,
        phone: " +91 98765 43210 ",
        address: " New Delhi, India ",
      }),
    ).toBe(true);
  });

  it("detects name changes", () => {
    expect(
      profilesEqual(BASE, {
        ...BASE,
        full_name: "Updated Name",
      }),
    ).toBe(false);
  });
});
