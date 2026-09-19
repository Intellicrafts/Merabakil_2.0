const HONORIFIC_PREFIXES = new Set([
  "adv",
  "adv.",
  "dr",
  "dr.",
  "mr",
  "mr.",
  "mrs",
  "mrs.",
  "ms",
  "ms.",
  "prof",
  "prof.",
  "shri",
  "smt",
]);

function isHonorific(token: string): boolean {
  const key = token.toLowerCase();
  return HONORIFIC_PREFIXES.has(key) || HONORIFIC_PREFIXES.has(`${key.replace(/\.$/, "")}.`);
}

/** First meaningful given name for greetings — skips honorifics like Adv. or Dr. */
export function getGreetingName(fullName?: string | null): string {
  if (!fullName?.trim()) return "there";
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  for (const part of parts) {
    if (!isHonorific(part)) {
      return part.replace(/\.$/, "");
    }
  }
  return parts[0]?.replace(/\.$/, "") ?? "there";
}
