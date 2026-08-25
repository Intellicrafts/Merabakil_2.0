"use client";

import { memo } from "react";
import Image from "next/image";
import { ArrowUpRight, BadgeCheck, MapPin, Sparkles, Star } from "lucide-react";

import { lawyerAvatarSrc } from "@/lib/lawyer-avatar";
import type { RankedLawyer } from "@/lib/marketplace-store";
import { cn } from "@/lib/utils";

function formatRate(rate: number | null): string {
  if (rate == null) return "Consultation available";
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
  const counsel = variant === "counsel";

  return (
    <article
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      className={cn(
        "mp-card-enter group relative flex h-full flex-col justify-between overflow-hidden p-4",
        counsel
          ? cn(
              "rounded-[1.35rem] border border-black/[0.06] bg-white",
              "shadow-[0_10px_28px_rgba(15,23,42,0.05)]",
              "transition-[border-color,box-shadow] duration-200",
              "hover:border-amber-800/20 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)]",
              "dark:border-white/[0.08] dark:bg-zinc-900/80",
              "dark:shadow-[0_12px_32px_rgba(0,0,0,0.28)]",
              "dark:hover:border-amber-400/25",
            )
          : cn(
              "rounded-2xl border border-black/[0.06] bg-white",
              "transition-colors duration-200",
              "hover:border-slate-300 hover:shadow-md",
              "dark:border-white/[0.08] dark:bg-zinc-900",
              "dark:hover:border-zinc-600",
              lawyer.ai_recommended && "ring-1 ring-slate-400/25 dark:ring-white/12",
            ),
        className,
      )}
    >

      <div className="relative">
        <div className="mb-3 flex items-start justify-between gap-2.5">
          <div className="flex min-w-0 items-start gap-2.5">
            <div className="relative">
              <div
                className={cn(
                  "relative h-11 w-11 overflow-hidden ring-1 ring-black/[0.06] shadow-sm dark:ring-white/10",
                  counsel ? "rounded-full" : "rounded-xl",
                )}
              >
                <Image
                  src={lawyerAvatarSrc(lawyer.slug || lawyer.id)}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              </div>
              {lawyer.verified && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm dark:bg-zinc-900">
                  <BadgeCheck className="h-3 w-3 text-slate-800 dark:text-slate-200" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-[14px] font-semibold tracking-tight">
                {lawyer.full_name}
              </h3>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Star className="h-2.5 w-2.5 fill-current text-amber-500" />
                <span className="font-semibold text-foreground/85">{lawyer.rating.toFixed(1)}</span>
                <span className="text-muted-foreground/75">({lawyer.review_count})</span>
              </div>
            </div>
          </div>

          <span
            className={cn(
              "shrink-0 tabular-nums",
              counsel
                ? "text-[11px] font-medium text-muted-foreground"
                : "rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200",
            )}
          >
            {lawyer.match_score}%
          </span>
        </div>

        {lawyer.ai_recommended && (
          <div
            className={cn(
              "mb-2.5 inline-flex items-center gap-1 font-semibold",
              counsel
                ? "text-[10px] tracking-wide text-amber-800/90 dark:text-amber-400/90"
                : "rounded-full border border-slate-300/70 bg-slate-100 px-2 py-0.5 text-[9px] text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200",
            )}
          >
            <Sparkles className="h-2.5 w-2.5" />
            {counsel ? "Suggested match" : "AI pick"}
          </div>
        )}

        <div className="mb-2.5 flex flex-wrap gap-1">
          {areas.map((area) => (
            <span
              key={area}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
                counsel
                  ? "rounded-full bg-black/[0.04] dark:bg-white/[0.06]"
                  : "rounded-md border border-black/[0.05] bg-black/[0.03] dark:border-white/[0.08] dark:bg-white/[0.05]",
              )}
            >
              {area}
            </span>
          ))}
          {more > 0 && (
            <span className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground">
              +{more}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5" />
            {lawyer.city}
          </span>
          <span>{lawyer.years_experience} yrs</span>
        </div>

        <p className="mt-2 text-[13px] font-semibold tracking-tight">
          {formatRate(lawyer.hourly_rate_inr)}
        </p>
      </div>

      <div
        className={cn(
          "relative mt-3.5 flex gap-1.5 pt-3",
          counsel ? "border-t border-black/[0.04] dark:border-white/[0.06]" : "border-t border-black/[0.05] dark:border-white/[0.06]",
        )}
      >
        <button
          type="button"
          className={cn(
            "h-9 flex-1 text-[12px] font-semibold transition-colors",
            counsel
              ? "rounded-full border border-black/[0.08] bg-transparent hover:bg-black/[0.03] dark:border-white/12 dark:hover:bg-white/[0.05]"
              : "rounded-xl border border-border bg-transparent hover:bg-slate-50 dark:hover:bg-zinc-800",
          )}
          onClick={() => onView(lawyer)}
        >
          Profile
        </button>
        <button
          type="button"
          className={cn(
            "flex h-9 flex-1 items-center justify-center text-[12px] font-semibold text-white transition-colors",
            counsel
              ? "rounded-full bg-amber-800 hover:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500"
              : "rounded-xl bg-amber-800 hover:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500",
          )}
          onClick={() => onBook(lawyer)}
        >
          Book
          <ArrowUpRight className="ml-0.5 h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
});
