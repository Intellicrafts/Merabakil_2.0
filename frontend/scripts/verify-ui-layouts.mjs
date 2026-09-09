import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

mkdirSync("/tmp/mb-ui-verify", { recursive: true });

function log(msg) {
  console.log(msg);
}

const user = {
  user_id: "ui-verify",
  email: "citizen@legalos.in",
  full_name: "Devesh",
  roles: ["citizen"],
  permissions: ["research:read", "case:read", "document:read"],
};

const lawyers = [
  {
    id: "lw-001",
    slug: "lw-001",
    full_name: "Adv. Priya Sharma",
    bar_council_id: "D/1234/2012",
    practice_areas: ["Criminal", "Constitutional"],
    city: "Delhi",
    jurisdictions: ["Delhi"],
    languages: ["English", "Hindi"],
    years_experience: 14,
    rating: 4.9,
    review_count: 128,
    verified: true,
    hourly_rate_inr: 4500,
    bio: "Senior criminal counsel.",
    match_score: 96,
    ai_recommended: true,
  },
  {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    full_name: "Adv. Demo Counsel",
    bar_council_id: "D/0000/2020",
    practice_areas: ["Family"],
    city: "Pune",
    jurisdictions: ["Maharashtra"],
    languages: ["English"],
    years_experience: 8,
    rating: 4.6,
    review_count: 22,
    verified: true,
    hourly_rate_inr: 2800,
    bio: "No photo on file.",
    photo_url: null,
    match_score: 81,
    ai_recommended: false,
  },
];

const appointments = [
  {
    id: "apt-1",
    lawyer_id: "lw-001",
    lawyer_name: "Adv. Priya Sharma",
    lawyer_slug: "lw-001",
    citizen_user_id: "ui-verify",
    lawyer_user_id: "lw-001",
    citizen_name: "Devesh",
    counterpart_name: "Adv. Priya Sharma",
    my_role: "citizen",
    date: "2026-09-10",
    time_slot: "16:00",
    scheduled_at: "2026-09-10T10:30:00.000Z",
    scheduled_end_at: "2026-09-10T11:00:00.000Z",
    matter_summary: "Bail consultation",
    status: "confirmed",
    source: "manual",
    join_state: "upcoming",
    seconds_until_start: 3600,
    seconds_until_end: 5400,
    opponent_present: false,
    pending_summon: false,
    created_at: "2026-09-09T06:00:00.000Z",
    metrics: {},
  },
];

async function seedSession(page) {
  await page.addInitScript((payload) => {
    localStorage.setItem("legalos.access_token", "ui-verify");
    localStorage.setItem("legalos.refresh_token", "ui-refresh");
    localStorage.setItem("legalos.user", JSON.stringify(payload.user));
    localStorage.setItem(
      "legalos.meravakil.conversations",
      JSON.stringify(payload.conversations),
    );
  }, {
    user,
    conversations: [
      {
        id: "c1",
        title: "Bail under Section 437",
        messages: [{ id: "m1", role: "user", content: "Can I get bail?", createdAt: "2026-09-09T06:00:00.000Z" }],
        documentId: null,
        attachedDocuments: [],
        jurisdiction: "Delhi",
        createdAt: "2026-09-09T06:00:00.000Z",
        updatedAt: "2026-09-09T08:00:00.000Z",
      },
      {
        id: "c2",
        title: "Property title dispute",
        messages: [{ id: "m2", role: "assistant", content: "Here is the cited path.", createdAt: "2026-09-08T12:00:00.000Z" }],
        documentId: null,
        attachedDocuments: [],
        jurisdiction: "Maharashtra",
        createdAt: "2026-09-08T12:00:00.000Z",
        updatedAt: "2026-09-08T12:30:00.000Z",
      },
    ],
  });
}

async function mockApis(page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    const api = /\/svc\/|localhost:80\d{2}|\/api\/v1\//.test(url);
    if (!api) return route.continue();
    if (url.includes("/auth/refresh")) {
      return route.fulfill({
        contentType: "application/json",
        json: { access_token: "ui-verify", refresh_token: "ui-refresh" },
      });
    }
    if (url.includes("/users/me")) {
      return route.fulfill({
        contentType: "application/json",
        json: { roles: user.roles, permissions: user.permissions },
      });
    }
    if (url.includes("/lawyers")) {
      return route.fulfill({ contentType: "application/json", json: lawyers });
    }
    if (url.includes("/appointments")) {
      return route.fulfill({ contentType: "application/json", json: appointments });
    }
    if (url.includes("/documents")) {
      return route.fulfill({
        contentType: "application/json",
        json: { items: [], page: 1, size: 12, total: 0 },
      });
    }
    if (url.includes("/wallet")) {
      return route.fulfill({ contentType: "application/json", json: { balance: "0" } });
    }
    return route.fulfill({ contentType: "application/json", status: 200, json: {} });
  });
}

async function shot(page, name) {
  const path = `/tmp/mb-ui-verify/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  log(`shot ${name}`);
}

async function run(width, height, prefix) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  await mockApis(page);
  await seedSession(page);
  await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /good (morning|afternoon|evening)/i }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  await shot(page, `${prefix}-dashboard`);

  log(`${prefix} ask visible: ${await page.getByPlaceholder(/ask saarthi/i).isVisible()}`);
  log(
    `${prefix} services: ${await page
      .getByText("Services", { exact: true })
      .first()
      .isVisible()
      .catch(() => false)}`,
  );
  log(
    `${prefix} workspace card: ${await page
      .getByText(/book an advocate|next consultation|ask saarthi|continue last chat/i)
      .first()
      .isVisible()
      .catch(() => false)}`,
  );

  page.on("request", (req) => {
    if (/lawyer|appointment|marketplace/i.test(req.url())) log(`${prefix} REQ ${req.method()} ${req.url()}`);
  });
  page.on("requestfailed", (req) => {
    if (/lawyer|appointment|marketplace/i.test(req.url())) {
      log(`${prefix} FAIL ${req.url()} ${req.failure()?.errorText}`);
    }
  });
  await page.goto("http://localhost:3000/lawyer-marketplace", { waitUntil: "domcontentloaded" });
  await page.locator("h1").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  await shot(page, `${prefix}-marketplace`);
  log(`${prefix} lawyer cards: ${await page.locator("article").count()}`);
  log(`${prefix} body hint: ${(await page.locator("body").innerText()).slice(0, 400).replace(/\s+/g, " ")}`);
  log(`${prefix} demo counsel: ${await page.getByText("Demo Counsel").first().isVisible().catch(() => false)}`);

  const citySelect = page.getByRole("button", { name: /filter by city/i });
  if (await citySelect.isVisible().catch(() => false)) {
    await citySelect.click();
    await page.waitForTimeout(400);
    await shot(page, `${prefix}-city-dropdown`);
    const option = page.getByRole("option", { name: "Delhi" }).first();
    if (await option.isVisible().catch(() => false)) await option.click();
    else await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  const account = page.getByRole("button", { name: /account menu/i });
  if (await account.isVisible().catch(() => false)) {
    await account.click();
    await page.waitForTimeout(400);
    await shot(page, `${prefix}-account-menu`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  const profile = page.getByRole("button", { name: /view /i }).first();
  if ((await profile.count()) > 0) {
    await profile.click();
    await page.waitForTimeout(400);
    await shot(page, `${prefix}-profile`);
    const close = page.getByRole("button", { name: /close/i }).first();
    if (await close.isVisible()) await close.click();
  }

  await page.getByRole("tab", { name: /bookings|my consultations/i }).click();
  await page.waitForTimeout(500);
  await shot(page, `${prefix}-bookings`);

  if (errors.length) log(`${prefix} pageerrors: ${errors.join(" | ")}`);
  else log(`${prefix} pageerrors: none`);

  await browser.close();
}

await run(390, 844, "mobile");
await run(1280, 800, "desktop");
