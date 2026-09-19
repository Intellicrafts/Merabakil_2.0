import { describe, expect, it } from "vitest";

import { getGreetingName } from "@/lib/display-name";

describe("getGreetingName", () => {
  it("skips advocate honorific prefix", () => {
    expect(getGreetingName("Adv. Priya Sharma")).toBe("Priya");
  });

  it("returns first token for plain names", () => {
    expect(getGreetingName("Aarav Mehta")).toBe("Aarav");
  });

  it("falls back when name is empty", () => {
    expect(getGreetingName("")).toBe("there");
    expect(getGreetingName(null)).toBe("there");
  });

  it("skips Dr. prefix", () => {
    expect(getGreetingName("Dr. Raj Kumar")).toBe("Raj");
  });
});
