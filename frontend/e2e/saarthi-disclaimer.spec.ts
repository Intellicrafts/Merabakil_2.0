import { expect, test, type Page } from "@playwright/test";

const CITIZEN_USER = {
  user_id: "00000000-0000-4000-8000-000000000011",
  email: "citizen@legalos.in",
  full_name: "Citizen User",
  roles: ["citizen"],
  permissions: ["research:read", "search:read"],
};

function mockAccessToken() {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 }),
  ).toString("base64url");
  return `eyJhbGciOiJub25lIn0.${payload}.x`;
}

async function loginCitizen(page: Page) {
  const token = mockAccessToken();
  await page.addInitScript(
    ({ user, accessToken }) => {
      localStorage.removeItem("legalos.saarthi.disclaimer.dismissed");
      localStorage.setItem("legalos.access_token", accessToken);
      localStorage.setItem("legalos.refresh_token", "mock-refresh");
      localStorage.setItem("legalos.user", JSON.stringify(user));
    },
    { user: CITIZEN_USER, accessToken: token },
  );
}

test.describe("Saarthi disclaimer banner", () => {
  test("empty state has no inline disclaimer copy", async ({ page }) => {
    await loginCitizen(page);
    await page.goto("/mera-vakil");
    await expect(page.getByRole("heading", { name: /^Saarthi$/i })).toBeVisible();
    await expect(page.getByText(/not a substitute for licensed legal advice/i)).not.toBeVisible();
  });

  test("disclaimer banner is dismissible and header stays visible", async ({ page }) => {
    await loginCitizen(page);
    await page.goto("/mera-vakil");
    const banner = page.getByRole("note");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/informational guidance only/i);
    await page.getByRole("button", { name: /Dismiss disclaimer/i }).click();
    await expect(banner).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Toggle theme/i })).toBeVisible();
  });
});
