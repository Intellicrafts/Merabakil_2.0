import { expect, test, type Page } from "@playwright/test";

const ADVOCATE = {
  user_id: "00000000-0000-4000-8000-000000000101",
  email: "advocate.tour@example.com",
  full_name: "Naveen Sheokand",
  roles: ["advocate"],
  permissions: ["research:read", "search:read", "case:read"],
};

const CITIZEN = {
  user_id: "00000000-0000-4000-8000-000000000102",
  email: "citizen.tour@example.com",
  full_name: "Asha Citizen",
  roles: ["citizen"],
  permissions: ["research:read", "search:read", "case:read"],
};

const REQUIRED = [
  "full_name",
  "bar_council_id",
  "pincode",
  "city",
  "location_state",
  "years_experience",
  "practice_areas",
  "jurisdictions",
  "hourly_rate",
] as const;

type Listing = {
  id: string;
  user_id: string;
  full_name: string;
  bar_council_id: string | null;
  practice_areas: string[];
  city: string;
  jurisdictions: string[];
  languages: string[];
  years_experience: number;
  rating: number;
  match_score: number;
  ai_recommended: boolean;
  listed: boolean;
  is_verified: boolean;
  hourly_rate: number;
  pincode: string;
  location_state: string;
  bio: string;
  missing_required: string[];
  verification_data: Record<string, unknown> | null;
};

function missingRequired(listing: Listing): string[] {
  const missing: string[] = [];
  const name = listing.full_name.trim();
  if (!name || name.toLowerCase() === "advocate") missing.push("full_name");
  if (!listing.bar_council_id) missing.push("bar_council_id");
  if (!listing.pincode) missing.push("pincode");
  if (!listing.city) missing.push("city");
  if (!listing.location_state) missing.push("location_state");
  if (listing.years_experience == null || Number.isNaN(listing.years_experience)) missing.push("years_experience");
  if (!listing.practice_areas.length) missing.push("practice_areas");
  if (!listing.jurisdictions.length) missing.push("jurisdictions");
  if (!listing.hourly_rate) missing.push("hourly_rate");
  return missing;
}

function emptyListing(userId: string): Listing {
  const listing: Listing = {
    id: "listing-1",
    user_id: userId,
    full_name: "Advocate",
    bar_council_id: null,
    practice_areas: [],
    city: "",
    jurisdictions: [],
    languages: [],
    years_experience: 0,
    rating: 0,
    match_score: 0,
    ai_recommended: false,
    listed: false,
    is_verified: false,
    hourly_rate: 0,
    pincode: "",
    location_state: "",
    bio: "",
    missing_required: [...REQUIRED],
    verification_data: null,
  };
  listing.missing_required = missingRequired(listing);
  if (!listing.years_experience) listing.missing_required = Array.from(new Set([...listing.missing_required, "years_experience"]));
  return listing;
}

function liveListing(userId: string): Listing {
  return {
    id: "listing-live",
    user_id: userId,
    full_name: "Naveen Sheokand",
    bar_council_id: "P/1417/2012",
    practice_areas: ["Criminal"],
    city: "Chandigarh",
    jurisdictions: ["Punjab and Haryana High Court"],
    languages: ["English", "Hindi"],
    years_experience: 14,
    rating: 4.8,
    match_score: 0,
    ai_recommended: false,
    listed: true,
    is_verified: true,
    hourly_rate: 1500,
    pincode: "160017",
    location_state: "Chandigarh",
    bio: "Criminal and bail matters before the Punjab and Haryana High Court.",
    missing_required: [],
    verification_data: { outcome: "verified", council: "Punjab & Haryana" },
  };
}

function json(route: { fulfill: (r: { status: number; contentType: string; body: string }) => Promise<void> }, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function seedSession(page: Page, user: typeof ADVOCATE) {
  await page.addInitScript((data) => {
    window.localStorage.setItem("legalos.access_token", "mock-access-token");
    window.localStorage.setItem("legalos.refresh_token", "mock-refresh-token");
    window.localStorage.setItem("legalos.user", JSON.stringify(data));
    window.localStorage.setItem(
      "legalos.consent",
      JSON.stringify({ version: 3, analytics: true, acceptedAt: new Date().toISOString() }),
    );
    void navigator.serviceWorker?.getRegistrations?.().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });
  }, user);
}

async function mockAuth(page: Page, user: typeof ADVOCATE) {
  await page.context().route("**/api/v1/auth/refresh", (route) =>
    json(route, { access_token: "mock-access-token", refresh_token: "mock-refresh-token" }),
  );
  await page.context().route("**/api/v1/users/me", (route) => json(route, user));
}

async function mockListing(page: Page, listing: Listing) {
  await page.context().route(/\/api\/v1\/lawyers\/me/, async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (req.url().includes("/verify")) {
      listing.is_verified = true;
      listing.verification_data = { outcome: "verified", council: "Punjab & Haryana" };
      listing.missing_required = missingRequired(listing);
      listing.listed = Boolean(listing.is_verified && listing.hourly_rate > 0);
      await json(route, { status: "verified", message: "Verified" });
      return;
    }
    if (req.method() === "PUT") {
      const body = (req.postDataJSON() ?? {}) as Partial<Listing> & {
        full_name?: string;
        bar_council_id?: string;
        hourly_rate?: number;
        years_experience?: number;
        location_state?: string;
        practice_areas?: string[];
        jurisdictions?: string[];
        bio?: string;
      };
      if (body.full_name !== undefined) listing.full_name = body.full_name;
      if (body.bar_council_id !== undefined) listing.bar_council_id = body.bar_council_id;
      if (body.pincode !== undefined) listing.pincode = String(body.pincode);
      if (body.city !== undefined) listing.city = body.city;
      if (body.location_state !== undefined) listing.location_state = body.location_state;
      if (body.years_experience !== undefined) listing.years_experience = body.years_experience;
      if (body.practice_areas !== undefined) listing.practice_areas = body.practice_areas;
      if (body.jurisdictions !== undefined) listing.jurisdictions = body.jurisdictions;
      if (body.hourly_rate !== undefined) listing.hourly_rate = body.hourly_rate;
      if (body.bio !== undefined) listing.bio = body.bio;
      listing.missing_required = missingRequired(listing);
      if (!listing.years_experience) {
        listing.missing_required = Array.from(new Set([...listing.missing_required, "years_experience"]));
      }
      listing.listed = Boolean(listing.is_verified && listing.hourly_rate > 0);
    }
    await json(route, listing);
  });

  await page.context().route("**/pincode/**", (route) =>
    json(route, [
      {
        Status: "Success",
        PostOffice: [{ District: "Chandigarh", State: "Chandigarh" }],
      },
    ]),
  );
}

test.describe("Advocate professional activation", () => {
  test.setTimeout(90_000);

  test("dashboard banner leads through identity, practice, fee, then ceremony", async ({ page }) => {
    const listing = emptyListing(ADVOCATE.user_id);
    await seedSession(page, ADVOCATE);
    await mockAuth(page, ADVOCATE);
    await mockListing(page, listing);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /good (morning|afternoon|evening)/i })).toBeVisible({
      timeout: 15000,
    });
    const banner = page.getByTestId("listing-activation-banner");
    await expect(banner).toBeVisible({ timeout: 15000 });
    await expect(banner.getByText(/your practice is not live yet/i)).toBeVisible();
    const next = banner.getByRole("link", { name: /^next$/i });
    await expect(next).toHaveAttribute("href", "/profile?activate=1");
    await Promise.all([
      page.waitForURL(/\/profile\?activate=1/, { timeout: 30000 }),
      next.click(),
    ]);
    await expect(page.getByRole("heading", { name: /my profile/i })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /verify your enrolment/i })).toBeVisible({ timeout: 15000 });

    await page.getByLabel(/office pincode/i).fill("160017");
    await expect(page.getByText(/chandigarh, chandigarh/i)).toBeVisible({ timeout: 10000 });
    await page.getByLabel(/name shown to clients/i).fill("Naveen Sheokand");
    await page.getByLabel(/bar council enrolment number/i).fill("P/1417/2012");
    await page.getByRole("button", { name: /verify and continue/i }).click();

    await expect(page.getByRole("heading", { name: /your practice/i })).toBeVisible({ timeout: 15000 });
    const criminal = page.getByRole("button", { name: "Criminal" });
    if ((await criminal.getAttribute("aria-pressed")) !== "true") await criminal.click();
    const court = page.getByRole("button", { name: "Punjab and Haryana High Court" });
    if ((await court.getAttribute("aria-pressed")) !== "true") await court.click();
    const years = page.getByLabel(/years of experience/i);
    if (!(await years.inputValue())) await years.fill("14");
    await page.getByRole("button", { name: /^continue$/i }).click();

    await expect(page.getByRole("heading", { name: /fee and about you/i })).toBeVisible({ timeout: 15000 });
    await page.getByLabel(/consultation fee/i).fill("1500");
    await page.getByRole("button", { name: /finish and go live/i }).click();

    const ceremony = page.getByTestId("listing-activation-ceremony");
    await expect(ceremony).toBeVisible({ timeout: 15000 });
    await expect(ceremony.getByRole("heading", { name: /your practice is live/i })).toBeVisible();
  });

  test("live advocate dashboard has no activation banner", async ({ page }) => {
    await seedSession(page, ADVOCATE);
    await mockAuth(page, ADVOCATE);
    await mockListing(page, liveListing(ADVOCATE.user_id));
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /good (morning|afternoon|evening)/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("listing-activation-banner")).toHaveCount(0);
  });

  test("citizen dashboard is unchanged", async ({ page }) => {
    await seedSession(page, CITIZEN);
    await mockAuth(page, CITIZEN);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /good (morning|afternoon|evening)/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByTestId("listing-activation-banner")).toHaveCount(0);
    await expect(page.getByText(/your practice is not live yet/i)).toHaveCount(0);
  });
});
