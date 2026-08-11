"use client";

import Image from "next/image";
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
  const stats = [
    { label: "Counsel", value: String(counselCount), icon: Users },
    { label: "Verified", value: String(verifiedCount), icon: BadgeCheck },
    { label: "Avg match", value: `${avgMatch}%`, icon: Sparkles },
  ];

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/55 backdrop-blur-xl",
        "px-4 py-5 sm:rounded-3xl sm:px-6 sm:py-6 md:px-7",
        "dark:border-white/[0.08] dark:bg-white/[0.03]",
        "mp-card-enter",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px mp-shimmer-line" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-slate-400/15 blur-3xl mp-hero-glow dark:bg-slate-300/10" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-slate-500/10 blur-3xl mp-hero-glow dark:bg-white/5" />

      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.05]">
            <span className="mp-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Counsel network
          </div>
          <h1 className="text-[1.45rem] font-semibold leading-[1.15] tracking-tight sm:text-[1.75rem] md:text-[1.95rem]">
            Find the right lawyer,{" "}
            <span className="gradient-text">matched intelligently</span>
          </h1>
          <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground sm:text-[14px]">
            Verified advocates across India with AI match scores and instant booking.
          </p>

          <div className="flex flex-wrap gap-2 pt-0.5">
            {stats.map(({ label, value, icon: Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <Icon className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
                <span className="text-muted-foreground">{label}</span>
                <span className="font-semibold tabular-nums tracking-tight">{value}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto hidden h-[140px] w-[220px] shrink-0 overflow-hidden rounded-2xl ring-1 ring-black/[0.06] dark:ring-white/10 md:block lg:h-[160px] lg:w-[260px]">
          <Image
            src="/marketplace/marketplace-hero.svg"
            alt=""
            fill
            priority
            className="object-cover"
            sizes="260px"
          />
        </div>
      </div>
    </header>
  );
}
