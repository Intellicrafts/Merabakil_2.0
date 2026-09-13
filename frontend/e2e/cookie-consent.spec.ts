import { test, expect } from "@playwright/test";

test.describe("Cookie consent", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("legalos.consent");
    });
  });

  test("banner appears on first visit", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: /Cookies & local storage/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Essential only/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Accept analytics/i })).toBeVisible();
  });

  test("accepting analytics persists choice and hides banner", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Accept analytics/i }).click();
    await expect(page.getByRole("dialog", { name: /Cookies & local storage/i })).not.toBeVisible();

    const consent = await page.evaluate(() => window.localStorage.getItem("legalos.consent"));
    expect(consent).toContain('"analytics":true');

    await page.reload();
    await expect(page.getByRole("dialog", { name: /Cookies & local storage/i })).not.toBeVisible();
  });

  test("plausible script is absent before consent", async ({ page }) => {
    await page.goto("/");
    const scripts = page.locator('script[src*="plausible.io"]');
    await expect(scripts).toHaveCount(0);
  });
});
