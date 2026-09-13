import { test, expect } from "@playwright/test";

test.describe("Legal pages", () => {
  test("privacy page renders policy content", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /Privacy Policy/i })).toBeVisible();
    await expect(page.getByText(/Grievance Officer/i)).toBeVisible();
  });

  test("terms page renders terms content", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /Terms of Service/i })).toBeVisible();
    await expect(page.getByText(/not a law firm/i)).toBeVisible();
  });

  test("faq page renders questions", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.getByRole("heading", { name: /Frequently Asked Questions/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /What is MeraBakil/i })).toBeVisible();
  });

  test("landing footer links to legal pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^Privacy$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Terms$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^FAQ$/i }).first()).toBeVisible();
  });
});
