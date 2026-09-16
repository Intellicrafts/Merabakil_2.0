// @smoke Admin appointment ops console
import { test, expect } from "@playwright/test";

const APT_ID = "e2e-admin-ops-apt";

const appointmentRow = {
  id: APT_ID,
  citizen_name: "Aarav Mehta",
  lawyer_name: "Adv. Priya Sharma",
  status: "live",
  join_state: "joinable",
  emergency_status: "none",
  priority: "normal",
  citizen_present: true,
  lawyer_present: false,
  seconds_until_end: 1800,
  scheduled_at: "2026-09-16T10:00:00Z",
  scheduled_end_at: "2026-09-16T10:30:00Z",
  date: "2026-09-16",
  time_slot: "Immediate",
  matter_summary: "Criminal defence consult",
  lawyer_id: "lawyer-1",
  citizen_moderation: { status: "none", reason: "", suspended_until: null },
  lawyer_moderation: { status: "none", reason: "", suspended_until: null },
};

const kickedAppointment = {
  ...appointmentRow,
  citizen_moderation: { status: "kicked", reason: "Removed by ops", suspended_until: null },
  citizen_present: false,
};

const sessionHealth = {
  appointment_id: APT_ID,
  status: "live",
  join_state: "joinable",
  citizen: { present: true, last_seen_at: null, moderation: { status: "none" }, livekit_connected: true },
  lawyer: { present: false, last_seen_at: null, moderation: { status: "none" }, livekit_connected: false },
  livekit: { configured: true, mode: "livekit", room: `apt-${APT_ID}`, participant_count: 1, participants: [] },
  call: null,
  summon: null,
  emergency: { status: "none", reason: "", ack_at: null },
  diagnostics: { issues: ["lawyer_not_present"] },
};

const activityLogs = {
  items: [
    {
      id: "log-1",
      type: "joined",
      actor_user_id: "u1",
      actor_name: "Aarav Mehta",
      actor_role: "citizen",
      summary: "Citizen joined the room",
      payload: {},
      created_at: "2026-09-16T10:01:00Z",
    },
  ],
  total: 1,
  page: 1,
  size: 50,
};

test.describe("Admin appointment ops", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/v1/admin/appointments**", async (route) => {
      const url = route.request().url();
      if (url.includes("/session-health")) {
        await route.fulfill({ json: sessionHealth });
        return;
      }
      if (url.includes("/logs")) {
        await route.fulfill({ json: activityLogs });
        return;
      }
      if (url.includes("/duration") && route.request().method() === "POST") {
        const body = route.request().postDataJSON() as { scheduled_end_at?: string; minutes_delta?: number };
        const nextEnd = body.scheduled_end_at ?? "2026-09-16T10:45:00Z";
        await route.fulfill({
          json: { ...appointmentRow, scheduled_end_at: nextEnd },
        });
        return;
      }
      if (url.includes(`/admin/appointments/${APT_ID}`) && route.request().method() === "GET") {
        await route.fulfill({
          json: {
            appointment: appointmentRow,
            messages: [],
            events: [],
          },
        });
        return;
      }
      await route.fulfill({
        json: {
          items: [appointmentRow],
          live_matrix: [appointmentRow],
          counts: { live: 1, confirmed: 0 },
          emergency_counts: { none: 1 },
          total: 1,
          live_total: 1,
        },
      });
    });

    await page.route("**/api/v1/admin/ops-events**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: 'data: {"type":"join","payload":{}}\n\n',
      });
    });

    await page.route("**/api/v1/admin/lawyers**", async (route) => {
      await route.fulfill({ json: [] });
    });

    await page.addInitScript(() => {
      localStorage.setItem(
        "legalos_auth",
        JSON.stringify({
          access_token: "e2e-admin-token",
          user: {
            user_id: "00000000-0000-4000-8000-000000000001",
            full_name: "Ops Admin",
            roles: ["admin"],
            permissions: ["user:manage", "research:read"],
          },
        }),
      );
    });
  });

  test("shows live matrix on desktop hub", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/admin/appointments");

    await expect(page.getByRole("heading", { name: /appointment operations/i })).toBeVisible();
    await expect(page.getByText("Aarav Mehta")).toBeVisible();
  });

  test("queue click navigates to command center", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/admin/appointments");
    await page.getByRole("button", { name: "Queue" }).click();
    await page.getByText("Adv. Priya Sharma").click();
    await expect(page).toHaveURL(new RegExp(`/admin/appointments/${APT_ID}`));
    await expect(page.getByText("Command center")).toBeVisible();
    await expect(page.getByText("Citizen: Aarav Mehta")).toBeVisible();
  });

  test("command view logs tab renders activity rows", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/admin/appointments/${APT_ID}`);
    await page.getByRole("button", { name: "Logs" }).click();
    await expect(page.getByText("Citizen joined the room")).toBeVisible();
  });

  test("kicked party shows allow rejoin button", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route(`**/api/v1/admin/appointments/${APT_ID}**`, async (route) => {
      if (route.request().method() === "GET" && !route.request().url().includes("session-health")) {
        await route.fulfill({
          json: {
            appointment: kickedAppointment,
            messages: [],
            events: [],
          },
        });
        return;
      }
      await route.continue();
    });
    await page.goto(`/admin/appointments/${APT_ID}`);
    await expect(page.getByRole("button", { name: "Allow rejoin" })).toBeVisible();
  });

  test("duration slider apply triggers API twice", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    let durationCalls = 0;
    await page.route("**/api/v1/admin/appointments/**/duration", async (route) => {
      durationCalls += 1;
      const body = route.request().postDataJSON() as { scheduled_end_at?: string };
      await route.fulfill({
        json: {
          ...appointmentRow,
          scheduled_end_at: body.scheduled_end_at ?? "2026-09-16T10:45:00Z",
        },
      });
    });
    await page.goto(`/admin/appointments/${APT_ID}`);
    for (let i = 0; i < 2; i += 1) {
      await page.locator('input[type="range"]').evaluate((el: HTMLInputElement) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        setter?.call(el, "15");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.getByRole("button", { name: "Apply duration change" }).click();
    }
    await expect.poll(() => durationCalls).toBe(2);
  });

  test("duration error shows toast message", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route("**/api/v1/admin/appointments/**/duration", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ detail: "End time must be at least 1 minute from now" }),
      });
    });
    await page.goto(`/admin/appointments/${APT_ID}`);
    await page.locator('input[type="range"]').evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(el, "-60");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.getByRole("button", { name: "Apply duration change" }).click();
    await expect(page.getByText("End time must be at least 1 minute from now")).toBeVisible();
  });

  test("mobile layout shows bottom tab bar", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/appointments");

    await expect(page.getByRole("button", { name: "Live" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Queue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "SOS" })).toBeVisible();
  });
});
