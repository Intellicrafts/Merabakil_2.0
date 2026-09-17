"use client";

import { cn } from "@/lib/utils";

interface MarketplaceHeroProps {
  counselCount: number;
  verifiedCount: number;
}

export function MarketplaceHero({
  counselCount,
  verifiedCount,
}: MarketplaceHeroProps) {
  return (
    <header className={cn("mp-card-enter space-y-0.5 pt-0.5 sm:pt-1")}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-[1.75rem]">
            Find an Advocate
          </h1>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground sm:text-[14px]">
            <span className="sm:hidden">
              Verified counsel matched to your matter.
            </span>
            <span className="hidden sm:inline">
              Verified counsel matched to your matter. View profiles, check experience, and book a consultation directly.
            </span>
          </p>
          {counselCount > 0 && (
            <p className="mt-1 text-[11.5px] text-muted-foreground/60">
              {counselCount} advocate{counselCount !== 1 ? "s" : ""} ·{" "}
              {verifiedCount} verified
            </p>
          )}
        </div>
      </div>

      <div className="h-px bg-black/[0.05] pt-3 dark:bg-white/[0.06] sm:pt-4" />
    </header>
  );
}
