# @smoke E2E smoke tests (requires running stack: make up && make seed)
import { test, expect } from "@playwright/test";

test.describe("Legal OS smoke", () => {
  test("login and open research console", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.getByLabel(/email/i).fill("admin@legalos.in");
    await page.getByLabel(/password/i).fill("admin123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/research/);
    await expect(page.getByText(/legal/i).first()).toBeVisible();
  });
});
