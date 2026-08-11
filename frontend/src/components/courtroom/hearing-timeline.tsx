"use client";

import type { HearingTimelineStep } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

const STEPS: { id: HearingTimelineStep; label: string }[] = [
  { id: "opening", label: "Matter called" },
  { id: "examination", label: "Arguments" },
  { id: "objections", label: "Objections" },
  { id: "closing", label: "Closing" },
  { id: "verdict", label: "Oral order" },
  { id: "deliberation", label: "Written order" },
];

interface HearingTimelineProps {
  activeStep: HearingTimelineStep;
}

export function HearingTimeline({ activeStep }: HearingTimelineProps) {
  const activeIndex = STEPS.findIndex((s) => s.id === activeStep);

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-2xl border border-black/[0.06] bg-white/55 px-3 py-3 backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.03]",
        "cs-card-in",
      )}
    >
      <div className="flex min-w-max gap-1.5">
        {STEPS.map((step, index) => {
          const done = activeIndex > index;
          const active = step.id === activeStep;
          return (
            <span
              key={step.id}
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                done &&
                  "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                active &&
                  !done &&
                  "border-stone-500/35 bg-stone-700 text-stone-50 dark:border-stone-400/30 dark:bg-stone-200 dark:text-stone-900",
                !done &&
                  !active &&
                  "border-black/[0.06] bg-white/60 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]",
              )}
            >
              {active && !done && (
                <span className="cs-live-dot mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              )}
              {step.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
