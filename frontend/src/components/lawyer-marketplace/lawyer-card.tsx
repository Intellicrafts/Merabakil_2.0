"use client";

import { memo } from "react";
import { Calendar, MapPin, Sparkles, Star, User } from "lucide-react";

import { LawyerAvatar } from "@/components/lawyer-marketplace/lawyer-avatar";
import { VerifiedBadge } from "@/components/lawyer-marketplace/verified-badge";
import { AnalyticsEvents, track } from "@/lib/analytics";
import type { RankedLawyer } from "@/lib/marketplace-store";
import { cn } from "@/lib/utils";

function formatRate(rate: number | null): string {
  if (rate == null) return "Available";
  return `₹${rate.toLocaleString("en-IN")}/hr`;
}

interface LawyerCardProps {
  lawyer: RankedLawyer;
  index?: number;
  variant?: "default" | "counsel";
  className?: string;
  onView: (lawyer: RankedLawyer) => void;
  onBook: (lawyer: RankedLawyer) => void;
}

export const LawyerCard = memo(function LawyerCard({
  lawyer,
  index = 0,
  variant = "default",
  className,
  onView,
  onBook,
}: LawyerCardProps) {
  const areas = lawyer.practice_areas.slice(0, 2);
  const more = lawyer.practice_areas.length - areas.length;
  const displayName = lawyer.full_name.replace(/^Adv\.\s*/i, "");

  function handleView() {
    track(AnalyticsEvents.LAWYER_PROFILE_VIEWED, { booking_source: "manual" });
    onView(lawyer);
  }

  function handleBook() {
    track(AnalyticsEvents.APPOINTMENT_CTA_CLICKED, { booking_source: "manual" });
    onBook(lawyer);
  }

  return (
    <article
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className={cn(
        "mp-card-enter mp-surface-card group relative flex h-full flex-col overflow-hidden rounded-[1.25rem]",
        "transition-[border-color,box-shadow,transform] duration-200",
        "sm:hover:-translate-y-0.5 sm:hover:shadow-[0_20px_44px_rgba(42,28,12,0.14)]",
        className,
      )}
    >
      {lawyer.verified && <span className="mp-verified-strip" aria-hidden />}

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={handleView}
            className="relative shrink-0"
            aria-label={`View ${lawyer.full_name}`}
          >
            <LawyerAvatar
              lawyer={lawyer}
              rounded="full"
              className="h-14 w-14 sm:h-[3.6rem] sm:w-[3.6rem]"
            />
            {lawyer.verified && (
              <span className="absolute -bottom-1 -right-1">
                <VerifiedBadge size="sm" />
              </span>
            )}
          </button>

          <button type="button" onClick={handleView} className="min-w-0 flex-1 text-left">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-[14.5px] font-semibold tracking-tight sm:text-[15px]">
                {variant === "counsel" ? displayName : lawyer.full_name}
              </h3>
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground dark:bg-white/[0.06]">
                <Sparkles className="h-2.5 w-2.5" />
                {lawyer.match_score}%
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Star className="h-3 w-3 fill-current text-amber-500/80" />
                <span className="font-medium text-foreground/80">{lawyer.rating.toFixed(1)}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {lawyer.city}
              </span>
              <span className="hidden items-center gap-1 sm:inline-flex">
                <Calendar className="h-3 w-3" />
                {lawyer.years_experience}y
              </span>
            </p>
          </button>
        </div>

        <div className="mt-3.5 flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {areas.map((area) => (
              <span
                key={area}
                className="rounded-full border border-black/[0.06] bg-black/[0.03] px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.05]"
              >
                {area}
              </span>
            ))}
            {more > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[10.5px] text-muted-foreground">
                +{more}
              </span>
            )}
          </div>
          <p className="shrink-0 text-[13.5px] font-semibold tracking-tight sm:text-[14px]">
            {formatRate(lawyer.hourly_rate_inr)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-black/[0.06] bg-[hsl(40_18%_97%)] p-3 sm:p-3.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
        <button
          type="button"
          className="mp-btn-primary inline-flex h-11 min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold sm:h-10 sm:min-h-10"
          onClick={handleView}
        >
          <User className="h-3.5 w-3.5" />
          Profile
        </button>
        <button
          type="button"
          className="mp-btn-accent inline-flex h-11 min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold sm:h-10 sm:min-h-10"
          onClick={handleBook}
        >
          <Calendar className="h-3.5 w-3.5" />
          Book
        </button>
      </div>
    </article>
  );
});
