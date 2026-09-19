import { describe, expect, it } from "vitest";

import {
  PROFILE_AVATAR_MAX_BYTES,
  PROFILE_AVATAR_QUALITY,
  PROFILE_AVATAR_SIZE,
} from "@/lib/image-profile";

describe("image-profile constants", () => {
  it("uses mobile-friendly avatar dimensions and compression targets", () => {
    expect(PROFILE_AVATAR_SIZE).toBe(512);
    expect(PROFILE_AVATAR_QUALITY).toBeGreaterThan(0.5);
    expect(PROFILE_AVATAR_QUALITY).toBeLessThanOrEqual(1);
    expect(PROFILE_AVATAR_MAX_BYTES).toBeLessThanOrEqual(500_000);
  });
});

describe("pickAvatarCandidate", () => {
  it("prefers server avatar over legacy localStorage value", async () => {
    const { pickAvatarCandidate } = await import("@/lib/avatar");
    expect(pickAvatarCandidate("/api/v1/users/me/avatar?v=1", "https://legacy.example/a.jpg")).toBe(
      "/api/v1/users/me/avatar?v=1",
    );
    expect(pickAvatarCandidate(null, "https://legacy.example/a.jpg")).toBe(
      "https://legacy.example/a.jpg",
    );
  });
});
