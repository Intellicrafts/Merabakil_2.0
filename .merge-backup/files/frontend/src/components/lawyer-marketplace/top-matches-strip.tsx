"use client";

import Image from "next/image";
import { BadgeCheck, Sparkles } from "lucide-react";

import { lawyerAvatarSrc } from "@/lib/lawyer-avatar";
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
    <section className="mp-card-enter space-y-2.5" aria-label="Top matches" style={{ animationDelay: "40ms" }}>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Top matches
          </h2>
        </div>
        <p className="text-[11px] text-muted-foreground/70">AI ranked</p>
      </div>

      <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 no-scrollbar snap-x snap-mandatory">
        {top.map((lawyer) => (
          <article
            key={lawyer.id}
            className={cn(
              "snap-start flex min-w-[220px] max-w-[260px] flex-1 items-center gap-3 rounded-2xl p-2.5",
              "border border-black/[0.06] bg-white/65 backdrop-blur-md",
              "shadow-[0_4px_16px_rgba(15,23,42,0.04)]",
              "dark:border-white/[0.08] dark:bg-white/[0.04]",
            )}
          >
            <button
              type="button"
              onClick={() => onView(lawyer)}
              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/[0.06] dark:ring-white/10"
              aria-label={`View ${lawyer.full_name}`}
            >
              <Image
                src={lawyerAvatarSrc(lawyer.slug || lawyer.id)}
                alt=""
                fill
                className="object-cover"
                sizes="44px"
              />
            </button>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-[13px] font-semibold tracking-tight">
                {lawyer.full_name.replace(/^Adv\.\s*/i, "")}
                {lawyer.verified && (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-slate-700 dark:text-slate-300" />
                )}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {lawyer.city} · {lawyer.match_score}% match
              </p>
            </div>
            <button
              type="button"
              onClick={() => onBook(lawyer)}
              className="mp-btn-primary shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold"
            >
              Book
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
