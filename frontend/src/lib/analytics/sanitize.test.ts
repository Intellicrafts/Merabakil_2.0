import { describe, expect, it } from "vitest";

import { sanitizeParams } from "@/lib/analytics/sanitize";

describe("sanitizeParams", () => {
  it("passes allowed keys with safe values", () => {
    expect(
      sanitizeParams({
        page_type: "auth",
        has_attachment: true,
        message_count_bucket: "1_5",
      }),
    ).toEqual({
      page_type: "auth",
      has_attachment: true,
      message_count_bucket: "1_5",
    });
  });

  it("strips forbidden PII and content keys", () => {
    expect(
      sanitizeParams({
        email: "user@example.com",
        question: "What is IPC 420?",
        page_type: "ai_chat",
      }),
    ).toEqual({ page_type: "ai_chat" });
  });

  it("strips unknown keys", () => {
    expect(sanitizeParams({ page_type: "dashboard", custom_field: "x" })).toEqual({
      page_type: "dashboard",
    });
  });

  it("strips strings longer than 100 characters", () => {
    expect(
      sanitizeParams({ page_type: "a".repeat(101) }),
    ).toBeUndefined();
  });

  it("returns undefined for empty allowed payload", () => {
    expect(sanitizeParams({ email: "secret@example.com" })).toBeUndefined();
  });
});
