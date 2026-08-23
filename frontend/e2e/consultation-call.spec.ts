// @smoke Consultation call signaling UI (mocked marketplace + LiveKit)
import { test, expect, type Page } from "@playwright/test";

const APT_ID = "e2e-call-apt";
const CALL_ID = "call-e2e-001";
const CITIZEN_ID = "00000000-0000-4000-8000-000000000011";
const ADVOCATE_ID = "00000000-0000-4000-8000-000000000010";

const now = new Date();
const end = new Date(now.getTime() + 60 * 60 * 1000);

function joinState(pendingIncoming?: Record<string, unknown>) {
  return {
    appointment_id: APT_ID,
    join_state: "joinable",
    seconds_until_start: 0,
    seconds_until_end: 3600,
    opponent_present: true,
    pending_summon: false,
    opponent_typing: false,
    status: "confirmed",
    scheduled_at: now.toISOString(),
    scheduled_end_at: end.toISOString(),
    priority: "normal",
    emergency_status: "none",
    emergency_reason: "",
    pending_incoming_call: pendingIncoming ?? null,
  };
}

function appointmentRecord(counterpartName: string, userRole: "citizen" | "advocate") {
  return {
    id: APT_ID,
    join_state: "joinable",
    status: "confirmed",
    counterpart_name: counterpartName,
    scheduled_at: now.toISOString(),
    scheduled_end_at: end.toISOString(),
    opponent_present: true,
    pending_summon: false,
    seconds_until_start: 0,
    seconds_until_end: 3600,
    citizen_user_id: CITIZEN_ID,
    lawyer_user_id: ADVOCATE_ID,
    role: userRole,
  };
}

function incomingCallPayload(callerId: string, callerName: string) {
  return {
    call_id: CALL_ID,
    appointment_id: APT_ID,
    mode: "video",
    caller_user_id: callerId,
    caller_name: callerName,
    started_at: now.toISOString(),
    status: "ringing",
  };
}

async function installMarketplaceMocks(
  page: Page,
  options: {
    role: "citizen" | "advocate";
    sseFrames?: Array<Record<string, unknown>>;
  },
) {
  const counterpart = options.role === "citizen" ? "Advocate Counsel" : "Citizen Client";
  let ringCount = 0;

  await page.route(`**/svc/marketplace/api/v1/appointments/${APT_ID}**`, async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/events") && method === "GET") {
      const frames = options.sseFrames ?? [{ type: "join", payload: {} }];
      const body = frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join("");
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body,
      });
      return;
    }

    if (url.endsWith(`/appointments/${APT_ID}`) && method === "GET") {
      await route.fulfill({ json: appointmentRecord(counterpart, options.role) });
      return;
    }

    if (url.includes("/join-state")) {
      await route.fulfill({ json: joinState() });
      return;
    }

    if (url.includes("/room-token") && method === "POST") {
      await route.fulfill({
        json: {
          configured: true,
          mode: "livekit",
          url: "wss://e2e.example.livekit.cloud",
          token: "e2e-token",
        },
      });
      return;
    }

    if (url.includes("/messages") && method === "GET") {
      await route.fulfill({ json: [] });
      return;
    }

    if (url.includes("/call/ring") && method === "POST") {
      ringCount += 1;
      const callerId = options.role === "citizen" ? CITIZEN_ID : ADVOCATE_ID;
      await route.fulfill({ json: incomingCallPayload(callerId, "You") });
      return;
    }

    if (url.includes("/call/respond") && method === "POST") {
      await route.fulfill({ json: incomingCallPayload(CITIZEN_ID, "Citizen Client") });
      return;
    }

    if (url.includes("/call/cancel")) {
      await route.fulfill({ json: incomingCallPayload(CITIZEN_ID, "Citizen Client") });
      return;
    }

    if (url.includes("/read") || url.includes("/leave") || url.includes("/typing")) {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.continue();
  });

  return { getRingCount: () => ringCount };
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill("ChangeMe!2026");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test.describe("Consultation call notifications", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __E2E_LIVEKIT__?: boolean }).__E2E_LIVEKIT__ = true;
    });
  });

  test("citizen starts video call and sees outgoing overlay", async ({ page }) => {
    await login(page, "citizen@legalos.in");
    await installMarketplaceMocks(page, { role: "citizen" });

    await page.goto(`/appointments/${APT_ID}/room`);
    await expect(page.getByRole("button", { name: /Video call/i })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /Video call/i }).click();
    await expect(page.getByText(/Calling Advocate Counsel/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Cancel call/i })).toBeVisible();
  });

  test("advocate sees incoming call overlay from SSE", async ({ page }) => {
    await login(page, "advocate@legalos.in");
    await installMarketplaceMocks(page, {
      role: "advocate",
      sseFrames: [
        { type: "join", payload: {} },
        { type: "incoming_call", payload: incomingCallPayload(CITIZEN_ID, "Citizen Client") },
      ],
    });

    await page.goto(`/appointments/${APT_ID}/room`);
    await expect(page.getByText(/Citizen Client/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /^Accept$/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: /^Decline$/i })).toBeVisible();
  });

  test("accepting incoming call shows in-call controls", async ({ page }) => {
    await login(page, "advocate@legalos.in");
    await installMarketplaceMocks(page, {
      role: "advocate",
      sseFrames: [
        { type: "join", payload: {} },
        { type: "incoming_call", payload: incomingCallPayload(CITIZEN_ID, "Citizen Client") },
      ],
    });

    await page.goto(`/appointments/${APT_ID}/room`);
    await expect(page.getByRole("button", { name: /^Accept$/i })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /^Accept$/i }).click();
    await expect(page.getByRole("button", { name: /^End$/i })).toBeVisible({ timeout: 10000 });
  });
});
