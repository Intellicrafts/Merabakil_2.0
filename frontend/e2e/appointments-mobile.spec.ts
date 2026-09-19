import { test, expect, type Page } from "@playwright/test";

const CITIZEN_EMAIL = "citizen@legalos.in";
const CITIZEN_PASSWORD = "ChangeMe!2026";

async function loginAsCitizen(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(CITIZEN_EMAIL);
  await page.getByLabel(/password/i).fill(CITIZEN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

async function mockAppointmentsList(page: Page) {
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60 * 1000);

  await page.route("**/svc/marketplace/api/v1/appointments**", async (route) => {
    const url = route.request().url();
    if (url.includes("/join-state")) {
      await route.fulfill({
        json: {
          appointment_id: "apt-mobile-1",
          join_state: "joinable",
          seconds_until_start: 0,
          seconds_until_end: 3600,
          opponent_present: false,
          pending_summon: false,
          opponent_typing: false,
          status: "confirmed",
          scheduled_at: now.toISOString(),
          scheduled_end_at: end.toISOString(),
          priority: "normal",
          emergency_status: "none",
          emergency_reason: "",
        },
      });
      return;
    }

    if (route.request().method() === "GET" && !url.includes("/appointments/")) {
      await route.fulfill({
        json: [
          {
            id: "apt-mobile-1",
            join_state: "joinable",
            status: "confirmed",
            counterpart_name: "Advocate Counsel",
            lawyer_name: "Advocate Counsel",
            matter_summary: "Property dispute consultation",
            scheduled_at: now.toISOString(),
            scheduled_end_at: end.toISOString(),
            time_slot: "10:00 AM",
            date: "Today",
            my_role: "citizen",
            opponent_present: false,
            pending_summon: false,
            seconds_until_start: 0,
            seconds_until_end: 3600,
          },
        ],
      });
      return;
    }

    await route.continue();
  });
}

test.describe("My Consultations mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("list renders filters and consultation card on mobile", async ({ page }) => {
    await loginAsCitizen(page);
    await mockAppointmentsList(page);

    await page.goto("/appointments");
    await expect(page.getByRole("button", { name: /Filters/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("Advocate Counsel")).toBeVisible();
    await expect(page.getByRole("link", { name: /Join room/i })).toBeVisible();
  });
});
