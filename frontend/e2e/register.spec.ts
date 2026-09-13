import { test, expect } from "@playwright/test";

test.describe("Registration consent", () => {
  test("terms checkbox is required before submit", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: /Create your account/i })).toBeVisible();

    const submit = page.getByRole("button", { name: /Create account/i });
    await expect(submit).toBeDisabled();

    await page.getByLabel(/email/i).fill("newuser@example.com");
    await page.getByLabel(/password/i).fill("TestPass123!");
    await page.getByLabel(/I agree to the/i).check();

    await expect(submit).toBeEnabled();
  });

  test("terms and privacy links open legal pages", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("link", { name: /Terms of Service/i })).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("link", { name: /Privacy Policy/i })).toHaveAttribute("href", "/privacy");
  });
});
