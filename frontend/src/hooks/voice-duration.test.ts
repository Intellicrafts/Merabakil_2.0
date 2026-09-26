import { describe, expect, it } from "vitest";

import { durationBucket } from "@/hooks/use-voice-bot";

describe("voice_session_ended duration_bucket", () => {
  it("buckets guest sessions and marks the 90s cap", () => {
    expect(durationBucket(12, "user", true)).toBe("<30s");
    expect(durationBucket(45, "user", true)).toBe("30-60s");
    expect(durationBucket(75, "error", true)).toBe("60-90s");
    expect(durationBucket(90, "limit", true)).toBe("90s_cap");
    expect(durationBucket(40, "limit", true)).toBe("90s_cap"); // server ended the preview
  });

  it("lets member sessions run past 90s", () => {
    expect(durationBucket(95, "user", false)).toBe("over_90s");
    expect(durationBucket(20, "user", false)).toBe("<30s");
  });
});
