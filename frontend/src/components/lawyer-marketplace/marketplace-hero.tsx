"use client";

import { BadgeCheck, Sparkles, Users } from "lucide-react";

import { cn } from "@/lib/utils";

interface MarketplaceHeroProps {
  counselCount: number;
  verifiedCount: number;
  avgMatch: number;
}

export function MarketplaceHero({
  counselCount,
  verifiedCount,
  avgMatch,
}: MarketplaceHeroProps) {
  return (
    <header className={cn("mp-card-enter space-y-2 pt-1")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-[1.55rem]">
            Find an Advocate
          </h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Browse verified advocates matched to your legal matter — citizens find expert
            representation, advocates discover quality client cases.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] dark:border-white/[0.08] dark:bg-white/[0.04]">
            <Users className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
            <span className="text-muted-foreground">Advocates</span>
            <span className="font-semibold tabular-nums">{counselCount}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] dark:border-white/[0.08] dark:bg-white/[0.04]">
            <BadgeCheck className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
            <span className="text-muted-foreground">Verified</span>
            <span className="font-semibold tabular-nums">{verifiedCount}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] dark:border-white/[0.08] dark:bg-white/[0.04]">
            <Sparkles className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
            <span className="text-muted-foreground">Avg match</span>
            <span className="font-semibold tabular-nums">{avgMatch}%</span>
          </span>
        </div>
      </div>

      <div className="h-px bg-black/[0.05] dark:bg-white/[0.06]" />
    </header>
  );
}
