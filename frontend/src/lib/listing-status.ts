/** Readable names for what keeps an advocate out of the listing / AI recommendations. */
const LABELS: Record<string, string> = {
  verification: "Bar Council verification",
  consultation_fee: "consultation fee",
  practice_areas: "practice areas",
  jurisdictions: "jurisdictions",
  years_experience: "years of experience",
  bio: "bio (50+ characters)",
};

export function describeMissing(keys: string[] | undefined): string {
  return (keys ?? []).map((k) => LABELS[k] ?? k.replace(/_/g, " ")).join(", ");
}
