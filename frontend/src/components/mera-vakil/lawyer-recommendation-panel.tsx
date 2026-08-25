"use client";

import { useState } from "react";

import { BookingDialog } from "@/components/lawyer-marketplace/booking-dialog";
import { LawyerCard } from "@/components/lawyer-marketplace/lawyer-card";
import { LawyerProfileDrawer } from "@/components/lawyer-marketplace/lawyer-profile-drawer";
import type { RankedLawyer } from "@/lib/marketplace-store";
import type { LawyerMatchResult } from "@/lib/types";

interface LawyerRecommendationPanelProps {
  lawyers: LawyerMatchResult[];
}

function toRankedLawyer(lawyer: LawyerMatchResult): RankedLawyer {
  return {
    id: lawyer.id,
    slug: lawyer.slug,
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
  const [profile, setProfile] = useState<RankedLawyer | null>(null);
  const [booking, setBooking] = useState<RankedLawyer | null>(null);

  if (!lawyers.length) return null;

  return (
    <section className="space-y-3" aria-label="Recommended lawyers">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Recommended counsel
        </p>
        <span className="text-[11px] tabular-nums text-muted-foreground/70">
          {lawyers.length} match{lawyers.length !== 1 ? "es" : ""}
        </span>
      </div>

      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {lawyers.map((lawyer, idx) => (
          <LawyerCard
            key={lawyer.id}
            lawyer={toRankedLawyer(lawyer)}
            index={idx}
            variant="counsel"
            className="min-w-[min(100%,17rem)] snap-start sm:min-w-0"
            onView={setProfile}
            onBook={setBooking}
          />
        ))}
      </div>

      <LawyerProfileDrawer
        lawyer={profile}
        open={Boolean(profile)}
        onClose={() => setProfile(null)}
        onBook={setBooking}
      />
      <BookingDialog
        lawyer={booking}
        open={Boolean(booking)}
        source="ai_match"
        onClose={() => setBooking(null)}
        onBooked={() => setBooking(null)}
      />
    </section>
  );
}
