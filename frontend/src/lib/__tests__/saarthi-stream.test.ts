import { afterEach, describe, expect, it, vi } from "vitest";

import { bucketLatency } from "@/lib/analytics/track";
import { GuestChallengeError, streamResearchGuest } from "@/lib/api";
import { statusLabel } from "@/lib/chat-status";
import { citedSources } from "@/lib/cited-sources";
import type { ResearchResponse } from "@/lib/types";

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const answer = (text: string) => ({
  query: "q",
  answer: text,
  sources: [],
  citations: [],
  web_sources: [],
  web_images: [],
  suggestions: [],
  confidence: { retrieval_strength: 0, source_agreement: 0, coverage: 0, overall: 0 },
  trace: [],
  mode: "agent",
});

/** A response whose body sends `first` now and `later` after `delayMs`. */
function streamingResponse(first: string, later = "", delayMs = 30, headers: Record<string, string> = {}) {
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(first));
      setTimeout(() => {
        if (later) controller.enqueue(enc.encode(later));
        controller.close();
      }, delayMs);
    },
  });
  return new Response(body, { status: 200, headers });
}

afterEach(() => vi.unstubAllGlobals());

describe("answer first, suggestions after", () => {
  it("resolves at done and delivers suggestions once they arrive", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        streamingResponse(
          sse("accepted", {}) + sse("token", { text: "Answer." }) + sse("done", answer("Answer.")),
          sse("suggestions", { suggestions: ["What next?"] }),
        ),
      ),
    );
    const got: string[][] = [];
    let arrived!: () => void;
    const suggestionsArrived = new Promise<void>((resolve) => (arrived = resolve));
    const result = await streamResearchGuest("q", undefined, [], {
      onSuggestions: (s) => {
        got.push(s);
        arrived();
      },
    });
    expect(result.answer).toBe("Answer.");
    expect(got).toEqual([]); // not waited for
    await suggestionsArrived;
    expect(got).toEqual([["What next?"]]);
  });

  it("handles suggestions that arrive in the same chunk as done, after the caller", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamingResponse(sse("done", answer("A")) + sse("suggestions", { suggestions: ["Q?"] }))),
    );
    const order: string[] = [];
    let arrived!: () => void;
    const done = new Promise<void>((resolve) => (arrived = resolve));
    await streamResearchGuest("q", undefined, [], {
      onSuggestions: () => {
        order.push("suggestions");
        arrived();
      },
    });
    order.push("caller");
    await done;
    expect(order).toEqual(["caller", "suggestions"]);
  });
});

describe("guest limit per device", () => {
  it("sends the device id and a bot-check token", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => streamingResponse(sse("done", answer("A"))));
    vi.stubGlobal("fetch", fetchMock);
    await streamResearchGuest("q", undefined, [], {}, { deviceId: "dev-1", turnstileToken: "tok" });
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["X-Guest-Id"]).toBe("dev-1");
    expect(headers["X-Turnstile-Token"]).toBe("tok");
  });

  it("turns a bot-check request into GuestChallengeError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: { code: "challenge_required" } }), { status: 403 })),
    );
    await expect(streamResearchGuest("q", undefined, [], {})).rejects.toBeInstanceOf(GuestChallengeError);
  });
});

describe("sources shown for an answer", () => {
  const research = {
    answer: "Deadline is 30 days [KB-2]. See also [WEB-1].",
    sources: [{ title: "Repealed Laws part 4" }, { title: "NI Act s.138" }],
    citations: [{ marker: "[KB-2]" }],
    web_sources: [{ title: "News", url: "https://a" }, { title: "Blog", url: "https://b" }],
  } as unknown as ResearchResponse;

  it("keeps only cited sources, with their original numbers", () => {
    const { kb, web } = citedSources(research);
    expect(kb.map(({ source, n }) => [n, source.title])).toEqual([[2, "NI Act s.138"]]);
    expect(web.map(({ n }) => n)).toEqual([1]);
  });
});

describe("progress line", () => {
  const t = (key: string) => `t:${key}`;
  it("maps server stages to translated labels", () => {
    expect(statusLabel("research", "Searching…", t)).toBe("t:chat.statusSearching");
    expect(statusLabel("writing", "Writing…", t)).toBe("t:chat.statusWriting");
    expect(statusLabel("draft_x", "Server text", t)).toBe("Server text");
  });
});

describe("latency buckets", () => {
  it("uses one wide scale for latency_bucket and ttft_bucket", () => {
    expect([1500, 4000, 9000, 15000, 25000].map(bucketLatency)).toEqual(["<2s", "2-5s", "5-10s", "10-20s", "20s+"]);
  });
});
