import { getHeroTheme, type PrimaryRole } from "@/lib/dashboard-config";
import { keywordsFromHeadline, topicFromHeadline } from "@/lib/legal-spotlight/keywords";
import { resolveSpotlightImage } from "@/lib/legal-spotlight/image-resolver";
import { fetchGoogleNewsStories, type RssStory } from "@/lib/legal-spotlight/rss";
import {
  spotlightAudienceForRole,
  type LegalSpotlight,
  type SpotlightAudience,
} from "@/lib/legal-spotlight/types";

const NEWS_QUERIES: Record<SpotlightAudience, string> = {
  citizen:
    "India legal rights OR consumer court OR citizen legal aid OR legal awareness India",
  advocate:
    "India Supreme Court OR litigation India OR Bar Council OR advocate practice India",
  general: "India legal news OR Indian judiciary OR law reform India",
};

const memoryCache = new Map<string, LegalSpotlight>();

function dateKeyInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function pickDailyStory(stories: RssStory[], audience: SpotlightAudience, dateKey: string): RssStory | null {
  if (!stories.length) return null;
  const seed = `${dateKey}:${audience}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return stories[hash % stories.length] ?? stories[0];
}

function fallbackSpotlight(role: PrimaryRole, audience: SpotlightAudience, dateKey: string): LegalSpotlight {
  const theme = getHeroTheme(role);
  return {
    headline: "Legal insights for India",
    topic: theme.mobileTagline,
    imageUrl: theme.visual.src.startsWith("/") ? theme.visual.src : "/dashboard/hero-legal.png",
    imageCredit: null,
    sourceUrl: null,
    sourceName: "MeraBakil",
    audience,
    dateKey,
    fallback: true,
  };
}

export async function getLegalSpotlight(role: PrimaryRole): Promise<LegalSpotlight> {
  const audience = spotlightAudienceForRole(role);
  const dateKey = dateKeyInIndia();
  const cacheKey = `${dateKey}:${audience}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  const stories = await fetchGoogleNewsStories(NEWS_QUERIES[audience]);
  const story = pickDailyStory(stories, audience, dateKey);

  if (!story) {
    const fb = fallbackSpotlight(role, audience, dateKey);
    memoryCache.set(cacheKey, fb);
    return fb;
  }

  const image = await resolveSpotlightImage(story.title, audience);
  const theme = getHeroTheme(role);

  const spotlight: LegalSpotlight = {
    headline: story.title,
    topic: topicFromHeadline(story.title),
    imageUrl: image?.url ?? theme.visual.src,
    imageCredit: image?.credit ?? null,
    sourceUrl: story.link,
    sourceName: "Google News",
    audience,
    dateKey,
    fallback: !image,
  };

  memoryCache.set(cacheKey, spotlight);
  return spotlight;
}

/** For tests — clear in-memory cache between runs. */
export function clearSpotlightCache(): void {
  memoryCache.clear();
}

export { keywordsFromHeadline };
