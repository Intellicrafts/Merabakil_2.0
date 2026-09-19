import { describe, expect, it } from "vitest";

import { keywordsFromHeadline } from "@/lib/legal-spotlight/keywords";
import { parseGoogleNewsRss } from "@/lib/legal-spotlight/rss";

describe("parseGoogleNewsRss", () => {
  it("extracts titles and links from RSS items", () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title><![CDATA[Supreme Court ruling on privacy]]></title>
          <link>https://news.example.com/story</link>
        </item>
      </channel></rss>`;
    const items = parseGoogleNewsRss(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Supreme Court ruling on privacy");
    expect(items[0].link).toBe("https://news.example.com/story");
  });
});

describe("keywordsFromHeadline", () => {
  it("filters stop words and returns keywords", () => {
    expect(keywordsFromHeadline("Supreme Court issues new ruling on privacy")).toContain("privacy");
    expect(keywordsFromHeadline("Supreme Court issues new ruling on privacy")).not.toContain("the");
  });
});
