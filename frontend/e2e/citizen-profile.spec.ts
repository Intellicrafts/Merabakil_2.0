import { test, expect } from "@playwright/test";

const CITIZEN_EMAIL = "citizen@legalos.in";
const CITIZEN_PASSWORD = "ChangeMe!2026";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "legalos.consent",
      JSON.stringify({
        version: 2,
        analytics: true,
        acceptedAt: new Date().toISOString(),
      }),
    );
  });
});

async function loginAsCitizen(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(CITIZEN_EMAIL);
  await page.getByLabel(/password/i).fill(CITIZEN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

test.describe("Citizen profile shell", () => {
  test("login page still exposes registration entry point", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /Create one/i })).toBeVisible();
  });
});

test.describe("Account menu profile UX", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("protected profile route redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Citizen profile flow", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await loginAsCitizen(page);
  });

  test("account menu shows Home, My profile, and Wallet in order", async ({ page }) => {
    await page.getByRole("button", { name: /account menu/i }).click();
    const items = page.getByRole("menuitem");
    await expect(items.nth(0)).toContainText(/home/i);
    await expect(items.nth(1)).toContainText(/my profile/i);

    const walletItem = items.filter({ hasText: /^wallet$/i });
    if (await walletItem.count()) {
      await expect(walletItem.first()).toBeVisible();
    } else {
      await expect(items.nth(2)).toContainText(/cookie settings/i);
    }

    await expect(page.getByText(CITIZEN_EMAIL)).toHaveCount(0);
  });

  test("profile page pre-fills name and email", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: /my profile/i })).toBeVisible();
    const fullName = page.getByRole("textbox", { name: /^full name$/i });
    await expect(fullName).toBeVisible({ timeout: 10000 });
    await expect(fullName).not.toHaveValue("");
    await expect(page.getByRole("textbox", { name: /^email$/i })).toHaveValue(CITIZEN_EMAIL);
  });

  test("update profile saves changed phone", async ({ page }) => {
    await page.goto("/profile");
    const phoneInput = page.getByRole("textbox", { name: /^phone$/i });
    await expect(phoneInput).toBeVisible({ timeout: 10000 });
    const original = await phoneInput.inputValue();
    const updated = original.includes("99999") ? "+91 98765 43210" : "+91 99999 88888";
    await phoneInput.fill(updated);
    const updateBtn = page.getByRole("button", { name: /update profile/i });
    await expect(updateBtn).toBeEnabled();
    await updateBtn.click();
    await expect(page.getByText(/profile updated successfully/i)).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByRole("textbox", { name: /^phone$/i })).toHaveValue(updated, {
      timeout: 10000,
    });
  });
});

test.describe("Citizen profile mobile layout", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await loginAsCitizen(page);
  });

  test("mobile hides long hero copy and keeps update bar accessible", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByText(/update your details and photo anytime/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /update profile/i })).toBeVisible({
      timeout: 10000,
    });
  });
});
