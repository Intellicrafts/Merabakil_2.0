"use client";

import { Scale } from "lucide-react";

import { LawyerCard } from "@/components/lawyer-marketplace/lawyer-card";
import type { LawyerMatchResult } from "@/lib/types";
import type { RankedLawyer } from "@/lib/marketplace-store";

interface LawyerRecommendationPanelProps {
  lawyers: LawyerMatchResult[];
}

function toRankedLawyer(lawyer: LawyerMatchResult): RankedLawyer {
  return {
    id: lawyer.id,
    full_name: lawyer.full_name,
    bar_council_id: lawyer.bar_council_id ?? "",
    practice_areas: lawyer.practice_areas,
    city: lawyer.jurisdictions[0] ?? "India",
    jurisdictions: lawyer.jurisdictions,
    languages: lawyer.languages,
    years_experience: lawyer.years_experience,
    rating: lawyer.rating,
    review_count: lawyer.rating_count,
    verified: lawyer.is_verified,
    hourly_rate_inr: lawyer.hourly_rate,
    bio: lawyer.summary,
    match_score: lawyer.match_score,
    ai_recommended: lawyer.ai_recommended,
  };
}

export function LawyerRecommendationPanel({ lawyers }: LawyerRecommendationPanelProps) {
  if (!lawyers.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white/40 shadow-[0_2px_10px_rgba(15,23,42,0.04)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center gap-2 border-b border-black/[0.05] px-3.5 py-2.5 dark:border-white/10">
        <Scale className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
        <span className="text-xs font-medium text-muted-foreground">
          Recommended Lawyers · {lawyers.length} match{lawyers.length !== 1 ? "es" : ""}
        </span>
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {lawyers.map((lawyer, idx) => (
          <LawyerCard
            key={lawyer.id}
            lawyer={toRankedLawyer(lawyer)}
            index={idx}
            onView={() => {}}
            onBook={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
