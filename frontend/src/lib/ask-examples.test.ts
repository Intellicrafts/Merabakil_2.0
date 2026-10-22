import { describe, expect, it } from "vitest";

import { ASK_EXAMPLES, ASK_FILTERS, POPULAR_IDS, examplesFor, filterForTopicParam, type AskTopic } from "@/lib/ask-examples";

const DEVANAGARI = /[ऀ-ॿ]/;
const TOPICS = ASK_FILTERS.filter((f): f is AskTopic => f !== "popular");

describe("ask page example questions", () => {
  it("has at least three questions for every topic, in more than one language", () => {
    for (const topic of TOPICS) {
      const items = ASK_EXAMPLES.filter((e) => e.topic === topic);
      expect(items.length, topic).toBeGreaterThanOrEqual(3);
      expect(new Set(items.map((e) => e.lang)).size, topic).toBeGreaterThan(1);
    }
  });

  it("keeps questions short and ids unique", () => {
    for (const e of ASK_EXAMPLES) expect(e.text.length, e.id).toBeLessThanOrEqual(120);
    expect(new Set(ASK_EXAMPLES.map((e) => e.id)).size).toBe(ASK_EXAMPLES.length);
  });

  it("writes Hindi in Devanagari and English/Hinglish in Latin script", () => {
    for (const e of ASK_EXAMPLES) {
      expect(DEVANAGARI.test(e.text), e.id).toBe(e.lang === "hi");
    }
  });

  it("shows six popular questions from six different topics", () => {
    const popular = examplesFor("popular", "en");
    expect(popular.map((e) => e.id)).toEqual([...POPULAR_IDS]);
    expect(new Set(popular.map((e) => e.topic)).size).toBeGreaterThanOrEqual(5);
  });

  it("puts Hindi first, then Hinglish, then English on the Hindi setting", () => {
    const order = examplesFor("popular", "hi").map((e) => e.lang);
    const rank = { hi: 0, hinglish: 1, en: 2 } as const;
    expect(order).toEqual([...order].sort((a, b) => rank[a] - rank[b]));
    expect(order[0]).toBe("hi");
    // English keeps the curated order.
    expect(examplesFor("property", "en").map((e) => e.id)).toEqual(
      ASK_EXAMPLES.filter((e) => e.topic === "property").map((e) => e.id),
    );
  });

  it("maps ?topic= from ads and legal guides onto a topic", () => {
    expect(filterForTopicParam("property")).toBe("property");
    expect(filterForTopicParam("family")).toBe("family");
    expect(filterForTopicParam("labour")).toBe("job");
    expect(filterForTopicParam(null)).toBe("popular");
    expect(filterForTopicParam("anything-else")).toBe("popular");
  });
});
