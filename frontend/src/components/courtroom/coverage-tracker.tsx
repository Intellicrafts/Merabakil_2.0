"use client";

import { CheckCircle2, Circle, CircleDot, Scale } from "lucide-react";

import type { HearingAgendaItem } from "@/lib/courtroom/types";
import { coveragePercent } from "@/lib/courtroom/hearing-agenda";
import { cn } from "@/lib/utils";

interface CoverageTrackerProps {
  agenda: HearingAgendaItem[];
}

const STATUS_ICON = {
  pending: Circle,
  raised: CircleDot,
  contested: CheckCircle2,
  resolved: CheckCircle2,
} as const;

export function CoverageTracker({ agenda }: CoverageTrackerProps) {
  if (!agenda.length) return null;
  const pct = coveragePercent(agenda);

  return (
    <section
      className={cn(
        "rounded-2xl border border-black/[0.06] bg-white/60 p-3 backdrop-blur-xl sm:p-4",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "cs-card-in",
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <Scale className="h-3.5 w-3.5 text-stone-600 dark:text-stone-300" strokeWidth={1.75} />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Case coverage
        </h2>
        <span className="ml-auto text-[11px] font-semibold tabular-nums text-foreground/80">
          {pct}%
        </span>
      </div>
      <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
        <div
          className="h-full rounded-full bg-stone-700 transition-all duration-500 dark:bg-stone-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {agenda.map((item) => {
          const Icon = STATUS_ICON[item.status];
          return (
            <li
              key={item.id}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                item.status === "pending" &&
                  "border-black/[0.06] bg-white/70 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]",
                item.status === "raised" &&
                  "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200",
                (item.status === "contested" || item.status === "resolved") &&
                  "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
              )}
              title={item.label}
            >
              <Icon className="h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span className="truncate">{item.label}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
