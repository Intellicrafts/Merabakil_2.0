import { keywordsFromHeadline } from "@/lib/legal-spotlight/keywords";
import type { SpotlightAudience } from "@/lib/legal-spotlight/types";

const AUDIENCE_IMAGE_QUERIES: Record<SpotlightAudience, string[]> = {
  citizen: [
    "Indian law justice citizen",
    "Supreme Court of India building",
    "legal consultation India",
  ],
  advocate: [
    "Indian courtroom advocate",
    "law books gavel India",
    "Supreme Court India",
  ],
  general: ["Indian legal system justice", "law court India"],
};

interface WikimediaHit {
  url: string;
  credit: string;
}

async function searchWikimedia(query: string): Promise<WikimediaHit | null> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata|mime");
  url.searchParams.set("iiurlwidth", "1400");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  try {
    const res = await fetch(url.toString(), { next: { revalidate: 86_400 } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            title?: string;
            imageinfo?: Array<{
              thumburl?: string;
              url?: string;
              mime?: string;
              extmetadata?: { Artist?: { value?: string }; LicenseShortName?: { value?: string } };
            }>;
          }
        >;
      };
    };

    const pages = data.query?.pages ?? {};
    for (const page of Object.values(pages)) {
      const info = page.imageinfo?.[0];
      if (!info?.thumburl && !info?.url) continue;
      if (info.mime && !info.mime.startsWith("image/")) continue;
      const artist = info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "") ?? "Wikimedia Commons";
      const license = info.extmetadata?.LicenseShortName?.value ?? "CC";
      return {
        url: info.thumburl ?? info.url!,
        credit: `${artist} · ${license}`,
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function resolvePexelsImage(query: string): Promise<WikimediaHit | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;

  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "landscape");

    const res = await fetch(url.toString(), {
      headers: { Authorization: key },
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      photos?: Array<{ src?: { large2x?: string; large?: string }; photographer?: string }>;
    };
    const photo = data.photos?.[0];
    if (!photo?.src?.large2x && !photo?.src?.large) return null;
    return {
      url: photo.src.large2x ?? photo.src.large!,
      credit: photo.photographer ? `${photo.photographer} · Pexels` : "Pexels",
    };
  } catch {
    return null;
  }
}

export async function resolveSpotlightImage(
  headline: string,
  audience: SpotlightAudience,
): Promise<WikimediaHit | null> {
  const keywordQueries = [
    `${keywordsFromHeadline(headline).join(" ")} India law`,
    ...AUDIENCE_IMAGE_QUERIES[audience],
  ];

  for (const query of keywordQueries) {
    if (!query.trim()) continue;
    const pexels = await resolvePexelsImage(query);
    if (pexels) return pexels;
    const wiki = await searchWikimedia(query);
    if (wiki) return wiki;
  }

  return null;
}
