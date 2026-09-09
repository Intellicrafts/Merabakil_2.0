"use client";

import { BadgeCheck } from "lucide-react";

import { LawyerAvatar } from "@/components/lawyer-marketplace/lawyer-avatar";
import type { RankedLawyer } from "@/lib/marketplace-store";
import { cn } from "@/lib/utils";

interface TopMatchesStripProps {
  lawyers: RankedLawyer[];
  onView: (lawyer: RankedLawyer) => void;
  onBook: (lawyer: RankedLawyer) => void;
}

export function TopMatchesStrip({ lawyers, onView, onBook }: TopMatchesStripProps) {
  const top = lawyers.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <section
      className="mp-card-enter hidden space-y-3 sm:block"
      aria-label="Recommended for you"
      style={{ animationDelay: "40ms" }}
    >
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Recommended for you
        </h2>
        <p className="text-[12px] text-muted-foreground/70">Highest match first</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {top.map((lawyer) => (
          <article
            key={lawyer.id}
            className={cn(
              "mp-surface-card flex items-center gap-3 rounded-[1.15rem] p-3.5",
              "transition-[border-color,box-shadow] duration-200",
            )}
          >
            <button
              type="button"
              onClick={() => onView(lawyer)}
              className="shrink-0"
              aria-label={`View ${lawyer.full_name}`}
            >
              <LawyerAvatar lawyer={lawyer} className="h-12 w-12 shadow-sm" rounded="2xl" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-[14px] font-semibold tracking-tight">
                {lawyer.full_name.replace(/^Adv\.\s*/i, "")}
                {lawyer.verified && (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-foreground/70" />
                )}
              </p>
              <p className="truncate text-[12px] text-muted-foreground">
                {lawyer.city} · {lawyer.match_score}% match
              </p>
            </div>
            <button
              type="button"
              onClick={() => onBook(lawyer)}
              className="mp-btn-accent h-9 shrink-0 rounded-xl px-3.5 text-[12px] font-semibold"
            >
              Book
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
