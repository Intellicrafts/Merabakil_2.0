// @smoke E2E smoke tests (requires running stack: make up && make seed)
import { test, expect } from "@playwright/test";

test.describe("Legal OS smoke", () => {
  test("landing page shows marketing content", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Meet Mera Vakil/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign In/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Get Started/i }).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /Chat/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Consult/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Documents/i })).toBeVisible();
  });

  test("login redirects to role dashboard", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await page.getByLabel(/email/i).fill("admin@legalos.in");
    await page.getByLabel(/password/i).fill("ChangeMe!2026");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText(/Platform control center/i)).toBeVisible();
  });
});

test.describe("Dashboard navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@legalos.in");
    await page.getByLabel(/password/i).fill("ChangeMe!2026");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
  });

  test("module cards render without hydration errors", async ({ page }) => {
    await expect(page.getByText(/Platform control center/i)).toBeVisible();
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
  });
});

test.describe("Lawyer marketplace search", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@legalos.in");
    await page.getByLabel(/password/i).fill("ChangeMe!2026");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.goto("/lawyer-marketplace");
  });

  test("debounces catalog fetch while typing", async ({ page }) => {
    let fetchCount = 0;
    await page.route("**/svc/marketplace/**", async (route) => {
      fetchCount += 1;
      await route.continue();
    });
    const search = page.getByPlaceholder(/search/i).first();
    if (await search.isVisible()) {
      await search.fill("crim");
      await page.waitForTimeout(100);
      await search.fill("criminal");
      await page.waitForTimeout(400);
      expect(fetchCount).toBeLessThanOrEqual(2);
    }
  });
});

test.describe("Mobile viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("dashboard scrolls on mobile", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("admin@legalos.in");
    await page.getByLabel(/password/i).fill("ChangeMe!2026");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByText(/Platform control center/i)).toBeVisible();
  });
});
