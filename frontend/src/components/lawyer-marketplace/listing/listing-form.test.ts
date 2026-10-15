import { describe, expect, it } from "vitest";

import type { RankedMarketplaceLawyer } from "@/lib/appointment-types";

import { firstErrorField, mapServerFields } from "./focus";
import {
  activationPromptKind,
  describeRequired,
  enrolmentYear,
  firstIncompleteStep,
  formatInr,
  fromListing,
  listingState,
  needsProfessionalActivation,
  officeLeavesCouncil,
  remainingRequiredCount,
  toPayload,
  usesSetup,
  validate,
  yearsSinceEnrolment,
  type ListingForm,
} from "./listing-form";

const NOW = new Date("2026-10-14T10:00:00+05:30");

const COMPLETE: ListingForm = {
  fullName: "Naveen Sheokhand",
  enrolment: "P/1417/2012",
  pincode: "160017",
  city: "Chandigarh",
  state: "Chandigarh",
  years: "14",
  practiceAreas: ["Criminal"],
  courts: ["Punjab and Haryana High Court"],
  languages: "English, Hindi, Punjabi",
  fee: "1500",
  bio: "",
};

function row(overrides: Partial<RankedMarketplaceLawyer>): RankedMarketplaceLawyer {
  return { id: "l1", full_name: "Naveen Sheokhand", ...overrides } as RankedMarketplaceLawyer;
}

const VERIFIED = { is_verified: true, verification_data: { outcome: "verified" } };

describe("validate", () => {
  it("accepts a complete listing", () => {
    expect(validate(COMPLETE, "all")).toEqual({});
  });

  it("checks only the fields of the step being saved — the office location comes with the enrolment", () => {
    const empty = { ...COMPLETE, fullName: "", enrolment: "", pincode: "", city: "", state: "", years: "" };
    expect(Object.keys(validate({ ...empty, practiceAreas: [], courts: [], fee: "" }, "identity")).sort()).toEqual([
      "city",
      "enrolment",
      "fullName",
      "pincode",
      "state",
    ]);
    expect(Object.keys(validate({ ...empty, practiceAreas: [], courts: [], languages: "" }, "practice")).sort()).toEqual(
      ["courts", "practiceAreas", "years"],
    );
    expect(Object.keys(validate({ ...COMPLETE, fee: "" }, "fee"))).toEqual(["fee"]);
  });

  it("needs a real name, not the placeholder", () => {
    expect(validate({ ...COMPLETE, fullName: "Advocate" }, "identity").fullName).toBeTruthy();
    expect(validate({ ...COMPLETE, fullName: "   " }, "identity").fullName).toBeTruthy();
  });

  it("needs a 6-digit pincode that doesn't start with 0", () => {
    for (const bad of ["", "16001", "1600171", "060017", "16OO17"]) {
      expect(validate({ ...COMPLETE, pincode: bad }, "identity").pincode).toBeTruthy();
    }
    expect(validate({ ...COMPLETE, pincode: "110001" }, "identity").pincode).toBeUndefined();
  });

  it("allows 0 years (less than a year) up to 70", () => {
    expect(validate({ ...COMPLETE, years: "0" }, "practice").years).toBeUndefined();
    expect(validate({ ...COMPLETE, years: "70" }, "practice").years).toBeUndefined();
    for (const bad of ["", "71", "5.5", "-1", "abc"]) {
      expect(validate({ ...COMPLETE, years: bad }, "practice").years).toBeTruthy();
    }
  });

  it("needs a fee of at least ₹1 in whole rupees, with no upper limit", () => {
    for (const bad of ["", "0", "15.5", "abc"]) {
      expect(validate({ ...COMPLETE, fee: bad }, "fee").fee).toBeTruthy();
    }
    expect(validate({ ...COMPLETE, fee: "1" }, "fee").fee).toBeUndefined();
    expect(validate({ ...COMPLETE, fee: "9999999" }, "fee").fee).toBeUndefined();
  });

  it("keeps the bio optional but bounded", () => {
    expect(validate({ ...COMPLETE, bio: "" }, "fee").bio).toBeUndefined();
    expect(validate({ ...COMPLETE, bio: "x".repeat(3001) }, "fee").bio).toBeTruthy();
  });
});

describe("toPayload", () => {
  it("sends only the step's fields", () => {
    expect(toPayload(COMPLETE, "identity")).toEqual({
      pincode: "160017",
      city: "Chandigarh",
      location_state: "Chandigarh",
      full_name: "Naveen Sheokhand",
      bar_council_id: "P/1417/2012",
    });
    expect(toPayload({ ...COMPLETE, languages: " English, ,Hindi " }, "practice")).toEqual({
      years_experience: 14,
      practice_areas: ["Criminal"],
      jurisdictions: ["Punjab and Haryana High Court"],
      languages: ["English", "Hindi"],
    });
    expect(toPayload({ ...COMPLETE, bio: "  Bail matters.  " }, "fee")).toEqual({ hourly_rate: 1500, bio: "Bail matters." });
  });

  it("sends 0 years as a real answer", () => {
    expect(toPayload({ ...COMPLETE, years: "0" }, "practice").years_experience).toBe(0);
  });

  it("sends everything when saving the whole listing", () => {
    expect(Object.keys(toPayload(COMPLETE, "all")).sort()).toEqual(
      [
        "bar_council_id",
        "bio",
        "city",
        "full_name",
        "hourly_rate",
        "jurisdictions",
        "languages",
        "location_state",
        "pincode",
        "practice_areas",
        "years_experience",
      ].sort(),
    );
  });
});

describe("fromListing", () => {
  it("starts a new advocate from the account name and blank required fields", () => {
    const form = fromListing(null, "Naveen");
    expect(form.fullName).toBe("Naveen");
    expect(form.years).toBe("");
    expect(form.fee).toBe("");
    expect(form.languages).toBe("English, Hindi");
  });

  it("replaces the placeholder listing name", () => {
    expect(fromListing(row({ full_name: "Advocate" }), "Naveen").fullName).toBe("Naveen");
  });

  it("tells 'never filled in' apart from 'less than a year'", () => {
    expect(fromListing(row({ years_experience: 0, practising_since: null }), "").years).toBe("");
    expect(fromListing(row({ years_experience: 0, practising_since: 2026 }), "").years).toBe("0");
    expect(fromListing(row({ years_experience: 9, practising_since: null }), "").years).toBe("9");
  });

  it("shows the fee in whole rupees", () => {
    expect(fromListing(row({ hourly_rate: 1500 }), "").fee).toBe("1500");
    expect(fromListing(row({ hourly_rate: null }), "").fee).toBe("");
  });
});

describe("enrolment year", () => {
  it.each([
    ["P/1417/2012", 2012],
    ["UP1234/25", 2025],
    ["UP1234/99", 1999],
    ["R/176A/1978", 1978],
    ["P/7-(SEN)/1964", 1964],
    ["D/1234/2010", 2010],
  ])("reads %s as %i", (enrolment, year) => {
    expect(enrolmentYear(enrolment, NOW)).toBe(year);
  });

  it("ignores numbers without a plausible year", () => {
    expect(enrolmentYear("ABC", NOW)).toBeNull();
    expect(enrolmentYear("P/1417/2031", NOW)).toBeNull();
    expect(enrolmentYear("P/1417/1890", NOW)).toBeNull();
  });

  it("counts years since enrolment for the experience prefill and warning", () => {
    expect(yearsSinceEnrolment("P/1417/2012", NOW)).toBe(14);
    expect(yearsSinceEnrolment("UP1234/26", NOW)).toBe(0);
    expect(yearsSinceEnrolment("no year", NOW)).toBeNull();
  });
});

describe("formatInr", () => {
  it("uses Indian digit grouping", () => {
    expect(formatInr(1500)).toBe("₹1,500");
    expect(formatInr(150000)).toBe("₹1,50,000");
  });
});

describe("where the advocate lands", () => {
  it("resumes setup at the first incomplete step", () => {
    expect(firstIncompleteStep(null)).toBe("identity");
    expect(firstIncompleteStep(row({ missing_required: ["bar_council_id", "pincode"] }))).toBe("identity");
    // The office pincode is part of step 1 now.
    expect(firstIncompleteStep(row({ ...VERIFIED, missing_required: ["pincode", "hourly_rate"] }))).toBe("identity");
    expect(firstIncompleteStep(row({ ...VERIFIED, missing_required: ["years_experience", "hourly_rate"] }))).toBe(
      "practice",
    );
    expect(firstIncompleteStep(row({ ...VERIFIED, missing_required: ["hourly_rate"] }))).toBe("fee");
    expect(
      firstIncompleteStep(
        row({ verification_data: { outcome: "needs_review", review_reason: "not_in_roll" }, missing_required: ["jurisdictions"] }),
      ),
    ).toBe("practice");
    expect(firstIncompleteStep(row({ verification_data: { outcome: "failed" }, missing_required: ["pincode"] }))).toBe(
      "identity",
    );
  });

  it("uses the guided setup only for new advocates", () => {
    expect(usesSetup(null, false)).toBe(true);
    expect(usesSetup(row({ listed: false, missing_required: ["pincode"] }), false)).toBe(true);
    expect(usesSetup(row({ listed: true, missing_required: ["pincode"] }), false)).toBe(false);
    expect(usesSetup(row({ listed: false, missing_required: [] }), false)).toBe(false);
    expect(usesSetup(null, true)).toBe(false);
  });
});

describe("listing status", () => {
  it("keeps advocates listed before the rules live, but flags what's missing", () => {
    expect(listingState(row({ listed: true, missing_required: [] }))).toBe("live");
    expect(listingState(row({ listed: true, missing_required: ["pincode"] }))).toBe("live_incomplete");
    expect(listingState(row({ listed: false, missing_required: ["pincode"] }))).toBe("incomplete");
    expect(listingState(row({ listed: false, missing_required: [], verification_data: { outcome: "needs_review" } }))).toBe(
      "under_review",
    );
    expect(listingState(row({ listed: false, missing_required: [], verification_data: { outcome: "failed" } }))).toBe(
      "not_verified",
    );
  });

  it("decides the dashboard activation prompt from listing state", () => {
    expect(activationPromptKind(null)).toBe("complete");
    expect(needsProfessionalActivation(null)).toBe(true);
    expect(activationPromptKind(row({ listed: false, missing_required: ["pincode"] }))).toBe("complete");
    expect(activationPromptKind(row({ listed: true, missing_required: ["pincode"] }))).toBe("complete");
    expect(activationPromptKind(row({ listed: false, missing_required: [], verification_data: { outcome: "failed" } }))).toBe(
      "complete",
    );
    expect(
      activationPromptKind(row({ listed: false, missing_required: [], verification_data: { outcome: "needs_review" } })),
    ).toBe("review");
    expect(activationPromptKind(row({ listed: true, missing_required: [] }))).toBeNull();
    expect(needsProfessionalActivation(row({ listed: true, missing_required: [] }))).toBe(false);
    expect(remainingRequiredCount(null)).toBe(9);
    expect(remainingRequiredCount(row({ missing_required: ["pincode", "hourly_rate"] }))).toBe(2);
  });

  it("names the missing details in plain words", () => {
    expect(describeRequired(["pincode"])).toBe("pincode");
    expect(describeRequired(["pincode", "city", "years_experience"])).toBe("pincode, city and years of experience");
    expect(describeRequired(["jurisdictions", "hourly_rate"])).toBe("courts and consultation fee");
    expect(describeRequired([])).toBe("");
  });
});

describe("server errors", () => {
  it("land on the matching field, and focus goes to the first one on screen", () => {
    const errors = mapServerFields({
      hourly_rate: "Enter your consultation fee.",
      pincode: "Enter a valid 6-digit pincode.",
      unknown: "ignored",
    });
    expect(errors).toEqual({ fee: "Enter your consultation fee.", pincode: "Enter a valid 6-digit pincode." });
    expect(firstErrorField(errors)).toBe("pincode");
  });
});

describe("an office move to another Bar Council's state", () => {
  const checked = (council: string | null, extra: Partial<RankedMarketplaceLawyer> = {}) =>
    row({
      bar_council_id: "P/1417/2012",
      location_state: "Chandigarh",
      is_verified: true,
      verification_data: { outcome: "verified", council, office_state: "Chandigarh" },
      ...extra,
    });

  it("needs a new check; a move within the same council doesn't", () => {
    expect(officeLeavesCouncil(checked("Punjab & Haryana"), "Uttar Pradesh")).toBe(true);
    expect(officeLeavesCouncil(checked("Punjab & Haryana"), "Haryana")).toBe(false);
    expect(officeLeavesCouncil(checked("Punjab & Haryana"), "Chandigarh")).toBe(false);
    expect(officeLeavesCouncil(checked("Punjab & Haryana"), "Maharashtra")).toBe(true);
  });

  it("uses the number's council for checks made before councils were recorded", () => {
    const older = row({ bar_council_id: "P/1417/2012", location_state: "", is_verified: true, verification_data: { outcome: "verified" } });
    expect(officeLeavesCouncil(older, "Chandigarh")).toBe(false);
    expect(officeLeavesCouncil(older, "Uttar Pradesh")).toBe(true);
  });

  it("tells councils we can't check apart by state", () => {
    const byHand = checked(null, { location_state: "Maharashtra", verification_data: { outcome: "verified", council: null, office_state: "Maharashtra" } });
    expect(officeLeavesCouncil(byHand, "Karnataka")).toBe(true);
    expect(officeLeavesCouncil(byHand, "Uttar Pradesh")).toBe(true);
  });
});
