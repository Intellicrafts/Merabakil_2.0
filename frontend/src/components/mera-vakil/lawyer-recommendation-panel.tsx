"use client";

import { CalendarPlus, Star } from "lucide-react";
import { useState } from "react";

import { BookingDialog } from "@/components/lawyer-marketplace/booking-dialog";
import { LawyerProfileDrawer } from "@/components/lawyer-marketplace/lawyer-profile-drawer";
import type { RankedLawyer } from "@/lib/marketplace-store";
import type { LawyerMatchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

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

const AVATAR_COLORS = [
  "from-blue-500/20 to-indigo-600/30 text-indigo-700 dark:from-blue-400/15 dark:to-indigo-500/20 dark:text-indigo-300",
  "from-violet-500/20 to-purple-600/30 text-purple-700 dark:from-violet-400/15 dark:to-purple-500/20 dark:text-purple-300",
  "from-emerald-500/20 to-teal-600/30 text-teal-700 dark:from-emerald-400/15 dark:to-teal-500/20 dark:text-teal-300",
  "from-rose-500/20 to-pink-600/30 text-rose-700 dark:from-rose-400/15 dark:to-pink-500/20 dark:text-rose-300",
  "from-amber-500/20 to-orange-600/30 text-amber-700 dark:from-amber-400/15 dark:to-orange-500/20 dark:text-amber-300",
];

interface LawyerBubbleProps {
  lawyer: LawyerMatchResult;
  index: number;
  onView: () => void;
  onBook: () => void;
}

function LawyerBubble({ lawyer, index, onView, onBook }: LawyerBubbleProps) {
  const initial = lawyer.full_name.charAt(0).toUpperCase();
  const area = lawyer.practice_areas[0] ?? "Advocate";
  const rating = lawyer.rating ?? 0;

  return (
    <div className="flex w-[calc(50%-0.25rem)] flex-col gap-2.5 rounded-2xl border border-black/[0.06] bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] dark:border-white/[0.08] dark:bg-zinc-900 dark:shadow-black/20 sm:w-auto sm:min-w-[9.5rem] sm:max-w-[12.5rem]">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[13px] font-bold",
            AVATAR_COLORS[index % AVATAR_COLORS.length],
          )}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <button
            type="button"
            onClick={onView}
            className="block w-full truncate text-left text-[12.5px] font-semibold text-foreground hover:underline"
          >
            {lawyer.full_name}
          </button>
          <p className="truncate text-[11px] text-muted-foreground">{area}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1.5">
        {rating > 0 ? (
          <span className="flex items-center gap-0.5 text-[11px] font-medium text-amber-500">
            <Star className="h-2.5 w-2.5 fill-amber-400 stroke-none" />
            {rating.toFixed(1)}
          </span>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onBook}
          className="flex items-center gap-1 rounded-lg bg-slate-900 px-2 py-1 text-[10.5px] font-semibold text-white transition-colors hover:bg-slate-700 active:scale-[0.97] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          <CalendarPlus className="h-2.5 w-2.5" />
          Book
        </button>
      </div>
    </div>
  );
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

      <div className="flex flex-wrap gap-2">
        {lawyers.map((lawyer, idx) => (
          <LawyerBubble
            key={lawyer.id}
            lawyer={lawyer}
            index={idx}
            onView={() => setProfile(toRankedLawyer(lawyer))}
            onBook={() => setBooking(toRankedLawyer(lawyer))}
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
