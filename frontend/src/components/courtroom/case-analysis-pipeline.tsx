"use client";

import type { ProcessingStep } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

const STEPS: { id: ProcessingStep; label: string }[] = [
  { id: "extracting", label: "Extracting intake" },
  { id: "profiling", label: "Profiling agents" },
  { id: "ready", label: "Ready" },
];

interface CaseAnalysisPipelineProps {
  activeStep: ProcessingStep;
}

export function CaseAnalysisPipeline({ activeStep }: CaseAnalysisPipelineProps) {
  const activeIndex = STEPS.findIndex((s) => s.id === activeStep);

  return (
    <section
      className={cn(
        "rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl sm:p-5",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "cs-card-in",
      )}
    >
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Case analysis pipeline
      </h2>
      <ol className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
        {STEPS.map((step, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          return (
            <li key={step.id} className="flex flex-1 items-center gap-2 sm:flex-col sm:gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums",
                  done && "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
                  active && "border-stone-500/50 bg-stone-700 text-stone-50 cs-ripple dark:bg-stone-200 dark:text-stone-900",
                  !done && !active && "border-black/[0.08] text-muted-foreground dark:border-white/10",
                )}
              >
                {done ? "✓" : i + 1}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium sm:text-center",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "hidden h-px flex-1 sm:block",
                    done ? "bg-emerald-500/40" : "bg-black/[0.06] dark:bg-white/10",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
