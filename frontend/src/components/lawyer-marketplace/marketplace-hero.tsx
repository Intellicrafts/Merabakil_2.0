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
    <header className={cn("mp-card-enter space-y-3 pt-0.5 sm:space-y-4 sm:pt-1")}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:block">
            Advocate booking
          </p>
          <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-[1.75rem]">
            <span className="sm:hidden">Advocates</span>
            <span className="hidden sm:inline">Find an Advocate</span>
          </h1>
          <p className="hidden max-w-xl text-[14px] leading-relaxed text-muted-foreground sm:block">
            Verified counsel matched to your matter. Review profiles, compare fit, and book a
            consultation in a few taps.
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <StatChip icon={Users} label="Advocates" value={counselCount} />
          <StatChip icon={BadgeCheck} label="Verified" value={verifiedCount} />
          <StatChip icon={Sparkles} label="Avg match" value={`${avgMatch}%`} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <MobileStat label="Advocates" value={counselCount} />
        <MobileStat label="Verified" value={verifiedCount} />
        <MobileStat label="Match" value={`${avgMatch}%`} />
      </div>

      <div className="hidden h-px bg-black/[0.05] dark:bg-white/[0.06] sm:block" />
    </header>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number | string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(28_14%_64%)] bg-white px-3 py-1.5 text-[12px] shadow-[0_4px_12px_rgba(42,28,12,0.05)] dark:border-white/[0.08] dark:bg-white/[0.04]">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function MobileStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="mp-surface-card rounded-2xl px-2.5 py-2 text-center">
      <p className="text-[15px] font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
