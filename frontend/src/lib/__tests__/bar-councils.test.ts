import { describe, expect, it } from "vitest";

import { BAR_COUNCILS, barCouncilForState, detectBarCouncil } from "@/lib/bar-councils";

describe("bar councils", () => {
  it("detects the council from the enrolment number", () => {
    expect(detectBarCouncil("P/1150/1993")).toBe("Punjab & Haryana");
    expect(detectBarCouncil("ph-6475-2023")).toBe("Punjab & Haryana");
    expect(detectBarCouncil("UP1234/2010")).toBe("Uttar Pradesh");
    expect(detectBarCouncil("AP/1/2000")).toBe("Andhra Pradesh"); // not mistaken for P/
    expect(detectBarCouncil("D/12/2015")).toBe("Delhi");
    expect(detectBarCouncil("R/176A/1978")).toBe("Rajasthan");
    expect(detectBarCouncil("PUNE/1/2000")).toBe("");
  });

  it("maps Punjab, Haryana and Chandigarh to their one council", () => {
    for (const state of ["Punjab", "HARYANA", "Chandigarh"]) expect(barCouncilForState(state)).toBe("Punjab & Haryana");
    expect(BAR_COUNCILS.map((c) => c.value)).toContain("Punjab & Haryana");
  });
});
