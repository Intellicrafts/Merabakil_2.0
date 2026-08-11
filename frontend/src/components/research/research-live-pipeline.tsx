"use client";

import { cn } from "@/lib/utils";

export const RESEARCH_STAGES = [
  { id: "intent", label: "Understanding" },
  { id: "jurisdiction", label: "Jurisdiction" },
  { id: "research", label: "Sources" },
  { id: "web", label: "Web" },
  { id: "answer", label: "Drafting" },
] as const;

export type ResearchStageId = (typeof RESEARCH_STAGES)[number]["id"];

interface ResearchLivePipelineProps {
  activeStage: string | null;
  statusMessage?: string | null;
  streaming?: boolean;
}

export function ResearchLivePipeline({
  activeStage,
  statusMessage,
  streaming,
}: ResearchLivePipelineProps) {
  if (!streaming && !activeStage) return null;

  const activeIndex = RESEARCH_STAGES.findIndex((s) => s.id === activeStage);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.04]",
        "rc-card-in",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rc-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Live pipeline
          </p>
        </div>
        {statusMessage && (
          <p className="text-[12px] text-muted-foreground">{statusMessage}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {RESEARCH_STAGES.map((stage, index) => {
          const done = activeIndex > index;
          const active = stage.id === activeStage;
          return (
            <span
              key={stage.id}
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                done &&
                  "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                active &&
                  "rc-stage-active border-slate-400/50 bg-slate-100 text-slate-800 dark:border-white/20 dark:bg-white/12 dark:text-zinc-100",
                !done &&
                  !active &&
                  "border-black/[0.06] bg-white/50 text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]",
              )}
            >
              {stage.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
