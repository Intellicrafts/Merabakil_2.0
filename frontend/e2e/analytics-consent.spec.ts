import { test, expect } from "@playwright/test";

test.describe("GA4 analytics consent", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("legalos.consent");
    });
  });

  test("GA script absent before consent", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  });

  test("GA script loads after accepting analytics", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Accept all/i }).click();
    await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(1, {
      timeout: 10_000,
    });
  });

  test("consent version 2 is stored on accept", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Accept all/i }).click();
    const consent = await page.evaluate(() => window.localStorage.getItem("legalos.consent"));
    expect(consent).toContain('"version":2');
    expect(consent).toContain('"analytics":true');
  });
});
