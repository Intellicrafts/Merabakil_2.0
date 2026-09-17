"use client";

import { memo } from "react";
import { Calendar, MapPin, Sparkles, Star, User } from "lucide-react";

import { LawyerAvatar } from "@/components/lawyer-marketplace/lawyer-avatar";
import { VerifiedBadge } from "@/components/lawyer-marketplace/verified-badge";
import { AnalyticsEvents, track } from "@/lib/analytics";
import type { RankedLawyer } from "@/lib/marketplace-store";
import { cn } from "@/lib/utils";

function MatchBadge({ score }: { score: number }) {
  const cls =
    score >= 90
      ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25"
      : score >= 75
      ? "bg-sky-500/10 text-sky-700 ring-sky-500/15 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/20"
      : "bg-black/[0.04] text-muted-foreground ring-black/[0.06] dark:bg-white/[0.06] dark:ring-white/[0.08]";
  return (
    <span
      title="AI relevance score — based on practice area, jurisdiction, experience, and case type"
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ring-1",
        cls,
      )}
    >
      <Sparkles className="h-2.5 w-2.5" />
      {score}%
    </span>
  );
}

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
  const areas = lawyer.practice_areas.slice(0, 3);
  const more = lawyer.practice_areas.length - areas.length;
  const displayName = lawyer.full_name.replace(/^Adv\.\s*/i, "");
  const name = variant === "counsel" ? displayName : lawyer.full_name;

  function handleView() {
    track(AnalyticsEvents.LAWYER_PROFILE_VIEWED, { booking_source: "manual" });
    onView(lawyer);
  }

  function handleBook() {
    track(AnalyticsEvents.APPOINTMENT_CTA_CLICKED, { booking_source: "manual" });
    onBook(lawyer);
  }

  const areaChips = (
    <>
      {areas.map((area) => (
        <span
          key={area}
          className="rounded-full border border-black/[0.06] bg-black/[0.03] px-2.5 py-0.5 text-[10.5px] font-medium text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.05]"
        >
          {area}
        </span>
      ))}
      {more > 0 && (
        <span className="rounded-full px-2 py-0.5 text-[10.5px] text-muted-foreground">
          +{more}
        </span>
      )}
    </>
  );

  const metaRow = (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Star className="h-3 w-3 fill-current text-amber-500/80" />
        <span className="font-medium text-foreground/75">{lawyer.rating.toFixed(1)}</span>
      </span>
      <span className="inline-flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        {lawyer.city}
      </span>
      <span className="inline-flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {lawyer.years_experience}y exp
      </span>
    </p>
  );

  const actionButtons = (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={handleView}
        className="mp-btn-primary inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold"
      >
        <User className="h-3.5 w-3.5" />
        Profile
      </button>
      <button
        type="button"
        onClick={handleBook}
        className="mp-btn-accent inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[12.5px] font-semibold"
      >
        <Calendar className="h-3.5 w-3.5" />
        Book
      </button>
    </div>
  );

  return (
    <article
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={cn(
        "mp-card-enter mp-surface-card group relative overflow-hidden rounded-[1.25rem]",
        "transition-[border-color,box-shadow] duration-200",
        "sm:hover:shadow-[0_10px_28px_rgba(42,28,12,0.09)]",
        className,
      )}
    >
      {lawyer.verified && <span className="mp-verified-strip" aria-hidden />}

      {/* ── Mobile layout (< sm): stacked rows ─────────────────────── */}
      <div className="flex flex-col gap-2.5 p-4 sm:hidden">
        {/* Row 1: avatar + name + match badge */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleView}
            className="relative shrink-0"
            aria-label={`View ${lawyer.full_name}`}
          >
            <LawyerAvatar lawyer={lawyer} rounded="full" className="h-12 w-12" />
            {lawyer.verified && (
              <span className="absolute -bottom-1 -right-1">
                <VerifiedBadge size="sm" />
              </span>
            )}
          </button>

          <button type="button" onClick={handleView} className="min-w-0 flex-1 text-left">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-[14px] font-semibold leading-snug">{name}</h3>
              <MatchBadge score={lawyer.match_score} />
            </div>
            {metaRow}
          </button>
        </div>

        {/* Row 2: practice areas */}
        <div className="flex flex-wrap gap-1.5">{areaChips}</div>

        {/* Row 3: rate + actions */}
        <div className="flex items-center justify-between gap-3 border-t border-black/[0.05] pt-2.5 dark:border-white/[0.07]">
          <p className="text-[13px] font-semibold">{formatRate(lawyer.hourly_rate_inr)}</p>
          {actionButtons}
        </div>
      </div>

      {/* ── Desktop layout (≥ sm): horizontal row ───────────────────── */}
      <div className="hidden sm:flex sm:items-center sm:gap-4 sm:px-5 sm:py-4">
        {/* Avatar */}
        <button
          type="button"
          onClick={handleView}
          className="relative shrink-0"
          aria-label={`View ${lawyer.full_name}`}
        >
          <LawyerAvatar lawyer={lawyer} rounded="full" className="h-[3.4rem] w-[3.4rem]" />
          {lawyer.verified && (
            <span className="absolute -bottom-1 -right-1">
              <VerifiedBadge size="sm" />
            </span>
          )}
        </button>

        {/* Name + meta (fixed width so columns align across cards) */}
        <button
          type="button"
          onClick={handleView}
          className="w-[196px] shrink-0 text-left"
        >
          <h3 className="truncate text-[14.5px] font-semibold leading-snug">{name}</h3>
          {metaRow}
        </button>

        {/* Vertical divider */}
        <div className="h-9 w-px shrink-0 bg-black/[0.05] dark:bg-white/[0.07]" />

        {/* Practice areas + bio (grows) */}
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">{areaChips}</div>
          {lawyer.bio && (
            <p className="line-clamp-1 text-[11.5px] leading-snug text-muted-foreground/70">
              {lawyer.bio}
            </p>
          )}
        </div>

        {/* Rate + match label + actions */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-[13.5px] font-semibold">{formatRate(lawyer.hourly_rate_inr)}</p>
            <div className="mt-1 flex flex-col items-end gap-0.5">
              <MatchBadge score={lawyer.match_score} />
              <p className="text-[9.5px] text-muted-foreground/50">AI match</p>
            </div>
          </div>
          {actionButtons}
        </div>
      </div>
    </article>
  );
});
