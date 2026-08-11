"use client";

import Image from "next/image";
import { Gavel, Scale, ShieldAlert } from "lucide-react";

import type { CourtroomPhase } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface CourtroomHeroProps {
  phase: CourtroomPhase;
  matterTitle?: string;
  elapsedSeconds?: number;
  /** True when viewing a locally saved completed run. */
  reviewingSaved?: boolean;
}

function formatPhase(phase: CourtroomPhase, reviewingSaved?: boolean): string {
  if (reviewingSaved) return "Reviewing saved run";
  const map: Record<CourtroomPhase, string> = {
    setup: "Prepare case",
    processing: "Processing intake",
    agentsReady: "Agents ready",
    hearing: "Live hearing",
    deliberation: "Deliberation",
    judgment: "Judgment delivered",
  };
  return map[phase];
}

export function CourtroomHero({
  phase,
  matterTitle,
  elapsedSeconds = 0,
  reviewingSaved = false,
}: CourtroomHeroProps) {
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/55 backdrop-blur-xl",
        "px-4 py-4 sm:rounded-3xl sm:px-6 sm:py-5",
        "dark:border-white/[0.08] dark:bg-white/[0.03]",
        "cs-card-in",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px cs-shimmer-line" />
      <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-amber-900/10 blur-3xl cs-hero-glow dark:bg-amber-200/5" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl space-y-2">
          <div className="cs-simulation-banner inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-900/80 dark:text-amber-200/80">
            <ShieldAlert className="h-3 w-3" strokeWidth={1.75} />
            AI Simulation — not a real court
          </div>
          <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-[1.65rem]">
            AI Courtroom Simulation
          </h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground sm:text-[14px]">
            {reviewingSaved
              ? matterTitle
                ? `Reviewing saved judgment — ${matterTitle}`
                : "Reviewing a simulation saved on this device."
              : matterTitle ||
                "Configure your matter and begin a procedural hearing with Judge and Advocate AI."}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
              <Gavel className="h-3 w-3" strokeWidth={1.75} />
              {formatPhase(phase, reviewingSaved)}
            </span>
            {reviewingSaved && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-700/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-900/85 dark:border-amber-200/20 dark:text-amber-100/85">
                Local archive
              </span>
            )}
            {!reviewingSaved && phase !== "setup" && phase !== "processing" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] tabular-nums text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
                <Scale className="h-3 w-3" strokeWidth={1.75} />
                {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
              </span>
            )}
          </div>
        </div>

        <div className="relative mx-auto h-[120px] w-full max-w-[220px] shrink-0 sm:h-[140px] sm:max-w-[260px] lg:mx-0">
          <Image
            src="/courtroom/courtroom-hero.svg"
            alt=""
            fill
            className="object-contain"
            sizes="260px"
            priority
          />
        </div>
      </div>
    </header>
  );
}
