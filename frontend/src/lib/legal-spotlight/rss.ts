export interface RssStory {
  title: string;
  link: string;
}

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:#x?[0-9a-f]+|[a-z]+);/gi, (match) => ENTITY_MAP[match] ?? match);
}

function stripTags(text: string): string {
  return decodeEntities(text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim());
}

function readTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripTags(match[1]) : null;
}

/** Parse Google News RSS XML into story items. */
export function parseGoogleNewsRss(xml: string): RssStory[] {
  const items: RssStory[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = readTag(block, "title");
    const link = readTag(block, "link");
    if (title && link) items.push({ title, link });
  }
  return items;
}

export async function fetchGoogleNewsStories(query: string, limit = 12): Promise<RssStory[]> {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-IN");
  url.searchParams.set("gl", "IN");
  url.searchParams.set("ceid", "IN:en");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "MeraBakil/1.0 (+https://merabakil.in)" },
    next: { revalidate: 86_400 },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseGoogleNewsRss(xml).slice(0, limit);
}
