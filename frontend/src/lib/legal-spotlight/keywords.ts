const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "will",
  "with",
  "after",
  "over",
  "says",
  "say",
  "new",
  "india",
  "indian",
  "court",
  "high",
  "supreme",
]);

/** Extract image search keywords from a news headline. */
export function keywordsFromHeadline(headline: string, max = 4): string[] {
  const cleaned = headline
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const words = cleaned
    .split(" ")
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  return [...new Set(words)].slice(0, max);
}

export function topicFromHeadline(headline: string, maxLen = 72): string {
  const trimmed = headline.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1).trim()}…`;
}
