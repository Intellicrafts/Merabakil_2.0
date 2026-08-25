import { expect, test, type Page, type Route } from "@playwright/test";

import { collectSpeechTranscript } from "../src/lib/speech-transcript";

const CITIZEN_USER = {
  user_id: "00000000-0000-4000-8000-000000000011",
  email: "citizen@legalos.in",
  full_name: "Citizen User",
  roles: ["citizen"],
  permissions: ["research:read", "search:read", "case:read", "document:read"],
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
      localStorage.setItem("legalos.access_token", accessToken);
      localStorage.setItem("legalos.refresh_token", "mock-refresh");
      localStorage.setItem("legalos.user", JSON.stringify(user));
    },
    { user: CITIZEN_USER, accessToken: token },
  );
}

const RESEARCH_DONE = {
  query: "",
  intent: "qa",
  jurisdiction: { country: "IN", level: "national", confidence: 1 },
  answer: "Cited guidance for this query.",
  sources: [],
  web_sources: [],
  web_images: [],
  suggestions: [],
  citations: [],
  confidence: { retrieval_strength: 0.8, source_agreement: 0.8, coverage: 0.8, overall: 0.8 },
  trace: [],
  specialist_payload: {},
  disclaimer: "Informational only.",
};

function speechResult(transcript: string, isFinal: boolean) {
  const row = [{ transcript }] as Array<{ transcript: string }> & { isFinal: boolean };
  row.isFinal = isFinal;
  return row;
}

async function mockResearch(page: Page, captured: { query: string }) {
  const fulfill = async (route: Route) => {
    const body = route.request().postDataJSON() as { query?: string };
    captured.query = body.query ?? "";
    const payload = [
      `event: token\ndata: ${JSON.stringify({ text: RESEARCH_DONE.answer })}\n\n`,
      `event: done\ndata: ${JSON.stringify({ ...RESEARCH_DONE, query: captured.query })}\n\n`,
    ].join("");
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: payload,
    });
  };
  await page.route("**/api/v1/research/stream", fulfill);
  await page.route("**/api/v1/research/document/**/stream", fulfill);
}

test.describe("speech transcript helper", () => {
  test("joins final and interim results from the full list", () => {
    const { finalText, liveText } = collectSpeechTranscript([
      speechResult("hello there", true),
      speechResult("how are you", false),
    ]);
    expect(finalText).toBe("hello there");
    expect(liveText).toBe("hello there how are you");
  });
});

test.describe("Mera Vakil composer", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("legalos.meravakil.conversations");
      localStorage.removeItem("legalos.meravakil.active-id");

      type ResultRow = Array<{ transcript: string }> & { isFinal: boolean };
      class MockSpeechRecognition {
        lang = "";
        continuous = false;
        interimResults = false;
        onresult: ((event: { results: ResultRow[] }) => void) | null = null;
        onerror: ((event: { error?: string }) => void) | null = null;
        onend: (() => void) | null = null;
        private results: ResultRow[] = [];

        start() {
          window.setTimeout(() => {
            const row: ResultRow = Object.assign([{ transcript: "What are my tenant rights in Delhi" }], {
              isFinal: false,
            });
            this.results = [row];
            this.onresult?.({ results: this.results });
          }, 40);
        }

        stop() {
          const row: ResultRow = Object.assign([{ transcript: "What are my tenant rights in Delhi" }], {
            isFinal: true,
          });
          this.results = [row];
          this.onresult?.({ results: this.results });
          window.setTimeout(() => this.onend?.(), 40);
        }

        abort() {
          this.onend?.();
        }
      }

      const w = window as Window & {
        SpeechRecognition?: typeof MockSpeechRecognition;
        webkitSpeechRecognition?: typeof MockSpeechRecognition;
        __gumCalls?: number;
      };
      w.SpeechRecognition = MockSpeechRecognition;
      w.webkitSpeechRecognition = MockSpeechRecognition;
      w.__gumCalls = 0;
      const media = navigator.mediaDevices;
      if (media?.getUserMedia) {
        const original = media.getUserMedia.bind(media);
        media.getUserMedia = async (constraints) => {
          w.__gumCalls = (w.__gumCalls ?? 0) + 1;
          return original(constraints);
        };
      }
    });
  });

  test("empty state is professional and starters send a query", async ({ page }) => {
    const captured = { query: "" };
    await mockResearch(page, captured);
    await loginCitizen(page);
    await page.goto("/mera-vakil");

    await expect(page.getByRole("heading", { name: /^Mera Vakil$/i })).toBeVisible();
    await expect(page.getByText(/Namaste/i)).toHaveCount(0);
    await expect(page.getByText("→")).toHaveCount(0);
    await expect(page.getByText(/Ask a legal question\. Receive cited guidance\./i)).toBeVisible();

    const suggestions = page.locator('[aria-label="Suggested questions"]');
    await expect(suggestions.getByRole("button", { name: "Know my rights" })).toBeVisible();
    await expect(suggestions.getByRole("button", { name: "Draft a complaint" })).toBeVisible();
    await expect(suggestions.getByRole("button", { name: "Explain a notice" })).toBeVisible();
    await expect(suggestions.getByRole("button", { name: "Find a lawyer" })).toBeVisible();

    await suggestions.getByRole("button", { name: "Know my rights" }).click();
    await expect(
      page.getByLabel("Chat conversation").getByText("What are my fundamental rights under the Indian Constitution?"),
    ).toBeVisible();
    await expect.poll(() => captured.query).toContain("fundamental rights");
  });

  test("typed send and Enter submit the matter", async ({ page }) => {
    const captured = { query: "" };
    await mockResearch(page, captured);
    await loginCitizen(page);
    await page.goto("/mera-vakil");

    const input = page.getByLabel("Chat message input");
    await input.fill("Explain eviction notice timelines in Delhi");
    await input.press("Enter");
    await expect(
      page.getByLabel("Chat conversation").getByText("Explain eviction notice timelines in Delhi"),
    ).toBeVisible();
    await expect.poll(() => captured.query).toBe("Explain eviction notice timelines in Delhi");
  });

  test("voice note records, cancel discards, send delivers transcript", async ({ page }) => {
    const captured = { query: "" };
    await mockResearch(page, captured);
    await loginCitizen(page);
    await page.goto("/mera-vakil");

    await page.getByRole("button", { name: "Record a voice note" }).click();
    await expect(page.getByText(/Listening/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send voice note" })).toBeVisible();

    await page.getByRole("button", { name: "Cancel voice note" }).click();
    await expect(page.getByLabel("Chat message input")).toBeVisible();
    await expect(page.getByText("What are my tenant rights in Delhi")).toHaveCount(0);

    await page.getByRole("button", { name: "Record a voice note" }).click();
    await expect(page.getByText("What are my tenant rights in Delhi")).toBeVisible();
    await page.getByRole("button", { name: "Send voice note" }).click();
    await expect(
      page.getByLabel("Chat conversation").getByText("What are my tenant rights in Delhi"),
    ).toBeVisible();
    await expect.poll(() => captured.query).toBe("What are my tenant rights in Delhi");

    const gumCalls = await page.evaluate(
      () => (window as Window & { __gumCalls?: number }).__gumCalls ?? 0,
    );
    expect(gumCalls).toBe(0);
  });

  test("empty dock opens live voice, files stage and send", async ({ page }) => {
    const captured = { query: "" };
    await mockResearch(page, captured);
    await page.route("**/api/v1/documents/upload", async (route) => {
      await route.fulfill({
        json: { document_id: "doc-e2e-1", title: "notes", status: "indexed" },
      });
    });
    await page.route("**/api/v1/documents/doc-e2e-1", async (route) => {
      await route.fulfill({
        json: { document_id: "doc-e2e-1", title: "notes", status: "indexed" },
      });
    });

    await loginCitizen(page);
    await page.goto("/mera-vakil");

    await page.getByRole("button", { name: "Start voice mode" }).click();
    await expect(page.getByRole("dialog", { name: "Voice mode" })).toBeVisible();
    await page.getByRole("button", { name: "Exit voice mode" }).click();
    await expect(page.getByRole("dialog", { name: "Voice mode" })).toHaveCount(0);

    await page.locator('input[type="file"]').setInputFiles({
      name: "notice.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 test"),
    });
    await expect(page.getByText("notice.pdf")).toBeVisible();
    await page.getByRole("button", { name: "Remove notice.pdf" }).click();
    await expect(page.getByText("notice.pdf")).toHaveCount(0);

    await page.locator('input[type="file"]').setInputFiles([
      {
        name: "notice.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 test"),
      },
      {
        name: "lease.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("lease terms"),
      },
    ]);
    await expect(page.getByText("notice.pdf")).toBeVisible();
    await expect(page.getByText("lease.txt")).toBeVisible();

    await page.getByRole("button", { name: "Send message" }).click();
    await expect(
      page.getByLabel("Chat conversation").getByText("Review the attached documents."),
    ).toBeVisible();
    await expect.poll(() => captured.query).toBe("Review the attached documents.");
  });

  test("counsel rail is icon-led and mobile opens a bottom sheet", async ({ page }) => {
    await page.addInitScript(() => {
      const now = new Date().toISOString();
      const conv = {
        id: "e2e-matter",
        title: "Tenant notice",
        messages: [],
        documentId: null,
        jurisdiction: "Delhi",
        matterType: "property",
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      localStorage.setItem("legalos.meravakil.conversations", JSON.stringify([conv]));
      localStorage.setItem("legalos.meravakil.active-id", "e2e-matter");
    });
    await loginCitizen(page);
    await page.goto("/mera-vakil");
    await expect(page.getByRole("heading", { name: /^Mera Vakil$/i })).toBeVisible();

    const rail = page.getByLabel("Session tools and history");
    await expect(rail.getByRole("button", { name: "New chat" })).toBeVisible();
    await expect(rail.getByRole("button", { name: "Search conversations" })).toBeVisible();
    await expect(rail.getByText("Your Legal Guide")).toHaveCount(0);
    await expect(rail.getByText("Common questions")).toHaveCount(0);
    await expect(rail.getByRole("button", { name: /^Sign out$/i })).toHaveCount(0);
    await expect(rail.getByText("Tenant notice")).toBeVisible();
    await expect(rail.getByRole("button", { name: "Property" })).toHaveAttribute("aria-pressed", "true");
    await expect(rail.getByLabel("Jurisdiction")).toHaveValue("Delhi");
    await rail.getByText("Tenant notice").hover();
    await rail.getByRole("button", { name: "Pin" }).click();
    await rail.getByText("Tenant notice").hover();
    await expect(rail.getByRole("button", { name: "Unpin" })).toBeVisible();

    await rail.getByRole("button", { name: "Search conversations" }).click();
    await expect(page.getByPlaceholder("Search")).toBeVisible();
    await rail.getByRole("button", { name: "More" }).click();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    await expect(rail.getByRole("button", { name: "Select read-aloud language" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /session panel/i }).click();
    const sheet = page.getByRole("dialog", { name: "Session panel" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: "New chat" })).toBeVisible();
    await expect(sheet.getByLabel("Conversation history")).toBeVisible();
    await sheet.getByRole("button", { name: "New chat" }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /^Mera Vakil$/i })).toBeVisible();
  });
});
