# @smoke E2E smoke tests (requires running stack: make up && make seed)
import { test, expect } from "@playwright/test";

test.describe("Legal OS smoke", () => {
  test("landing page shows marketing content", async ({ page }) => {
    await page.goto("http://localhost:3000/");
    await expect(page.getByRole("heading", { name: /AI Legal OS for/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign In/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Get Started/i }).first()).toBeVisible();
  });

  test("login redirects to role dashboard", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.getByLabel(/email/i).fill("admin@legalos.in");
    await page.getByLabel(/password/i).fill("ChangeMe!2026");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
    await expect(page.getByText(/Platform control center/i)).toBeVisible();
  });
});
