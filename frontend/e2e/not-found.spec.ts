import { test, expect } from "@playwright/test";

test.describe("Custom 404", () => {
  test("unknown route shows branded not found page", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-xyz");
    await expect(page.getByRole("heading", { name: /Page not found/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to home/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ask Saarthi/i })).toBeVisible();
  });
});
