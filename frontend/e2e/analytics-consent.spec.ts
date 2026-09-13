import { test, expect } from "@playwright/test";

const gaEnabled = process.env.NEXT_PUBLIC_GA_ENABLED === "true";

test.describe("GA4 analytics consent", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("legalos.consent");
    });
  });

  test("GA script loads when analytics is enabled (Consent Mode v2)", async ({ page }) => {
    test.skip(!gaEnabled, "Set NEXT_PUBLIC_GA_ENABLED=true in .env to run GA e2e tests");

    await page.goto("/");
    await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(1, {
      timeout: 10_000,
    });
  });

  test("GA script absent when analytics is disabled", async ({ page }) => {
    test.skip(gaEnabled, "GA is enabled — skip absent-script test");

    await page.goto("/");
    await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  });

  test("consent version 2 is stored on accept", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Accept all/i }).click();
    const consent = await page.evaluate(() => window.localStorage.getItem("legalos.consent"));
    expect(consent).toContain('"version":2');
    expect(consent).toContain('"analytics":true');
  });
});
