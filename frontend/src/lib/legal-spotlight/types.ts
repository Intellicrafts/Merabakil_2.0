import type { PrimaryRole } from "@/lib/dashboard-config";

export type SpotlightAudience = "citizen" | "advocate" | "general";

export interface LegalSpotlight {
  headline: string;
  topic: string;
  imageUrl: string;
  imageCredit: string | null;
  sourceUrl: string | null;
  sourceName: string;
  audience: SpotlightAudience;
  dateKey: string;
  fallback: boolean;
}

export function spotlightAudienceForRole(role: PrimaryRole): SpotlightAudience {
  if (role === "citizen") return "citizen";
  if (role === "advocate") return "advocate";
  return "general";
}
