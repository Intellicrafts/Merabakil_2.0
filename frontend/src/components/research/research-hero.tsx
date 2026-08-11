"use client";

import { BookOpen, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export function ResearchHero() {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/55 backdrop-blur-xl",
        "px-4 py-4 sm:rounded-3xl sm:px-6 sm:py-5",
        "dark:border-white/[0.08] dark:bg-white/[0.03]",
        "rc-card-in",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px rc-shimmer-line" />
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-slate-400/15 blur-3xl rc-hero-glow dark:bg-slate-300/10" />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:border-white/10 dark:bg-white/[0.05]">
            <span className="rc-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live grounded research
          </div>
          <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-[1.65rem]">
            Research Console
          </h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground sm:text-[14px]">
            Citation-grounded answers with confidence scoring and live pipeline visibility —
            built for Indian law.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
            <BookOpen className="h-3 w-3" strokeWidth={1.75} />
            Corpus indexed
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
            <Sparkles className="h-3 w-3" strokeWidth={1.75} />
            AI stream
          </span>
        </div>
      </div>
    </header>
  );
}
