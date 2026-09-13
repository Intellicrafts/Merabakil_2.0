import { test, expect } from "@playwright/test";

test.describe("Cookie consent", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem("legalos.consent");
    });
  });

  test("banner appears on first visit", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("dialog", { name: /We use cookies/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Necessary only/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Accept all/i })).toBeVisible();
  });

  test("accepting analytics persists choice and hides banner", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Accept all/i }).click();
    await expect(page.getByRole("dialog", { name: /We use cookies/i })).not.toBeVisible();

    const consent = await page.evaluate(() => window.localStorage.getItem("legalos.consent"));
    expect(consent).toContain('"analytics":true');

    await page.reload();
    await expect(page.getByRole("dialog", { name: /We use cookies/i })).not.toBeVisible();
  });

  test("third-party analytics scripts are absent before consent", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('script[src*="plausible.io"]')).toHaveCount(0);
    await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(0);
  });
});
