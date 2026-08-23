import { expect, test } from "@playwright/test";

const onboardingPayload = {
  onboarding_token: "mock-onboarding-token",
  email: "new.google@example.com",
  full_name: "New Google User",
  picture: null,
};

const mockAuthUser = {
  user_id: "00000000-0000-4000-8000-000000000001",
  email: "google@example.com",
  full_name: "Google User",
  roles: ["citizen"],
  permissions: ["research:read", "search:read", "case:read"],
};

const mockTokens = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  token_type: "bearer",
};

function seedOnboarding(page: import("@playwright/test").Page, payload = onboardingPayload) {
  return page.addInitScript((data) => {
    sessionStorage.setItem("legalos.google.onboarding", JSON.stringify(data));
  }, payload);
}

test.describe("Google auth UI", () => {
  test("login page renders auth shell", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByLabel(/continue with x/i)).toBeVisible();
  });

  test("new Google user completes role onboarding to dashboard", async ({ page }) => {
    await seedOnboarding(page);
    await page.route("**/api/v1/auth/google/complete", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          user: { ...mockAuthUser, email: onboardingPayload.email, roles: ["advocate"] },
          tokens: mockTokens,
        }),
      });
    });

    await page.goto("/auth/onboarding/role");
    await expect(page.getByRole("heading", { name: /choose your account type/i })).toBeVisible();
    await page.getByRole("button", { name: /^Advocate/i }).click();
    await page.getByRole("button", { name: /continue to dashboard/i }).click();
    await page.waitForURL(/\/dashboard\/?$/);
  });

  test("role onboarding is responsive on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await seedOnboarding(page, {
      ...onboardingPayload,
      email: "mobile@example.com",
      full_name: "Mobile User",
    });
    await page.goto("/auth/onboarding/role");
    await expect(page.getByRole("button", { name: /continue to dashboard/i })).toBeVisible();
  });
});

test.describe("Google auth redirects", () => {
  test("onboarding honors next param after complete", async ({ page }) => {
    await seedOnboarding(page, {
      ...onboardingPayload,
      email: "next@example.com",
      full_name: "Next User",
    });

    await page.route("**/api/v1/auth/google/complete", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ user: mockAuthUser, tokens: mockTokens }),
      });
    });

    await page.goto("/auth/onboarding/role?next=%2Fresearch");
    await page.getByRole("button", { name: /continue to dashboard/i }).click();
    await page.waitForURL(/\/research\/?$/);
  });
});
