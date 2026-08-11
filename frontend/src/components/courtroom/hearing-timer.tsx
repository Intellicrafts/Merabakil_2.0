"use client";

import { Clock, Pause } from "lucide-react";

import { cn } from "@/lib/utils";

interface HearingTimerProps {
  elapsedSeconds: number;
  isPaused: boolean;
}

export function HearingTimer({ elapsedSeconds, isPaused }: HearingTimerProps) {
  const mins = Math.floor(elapsedSeconds / 60);
  const secs = elapsedSeconds % 60;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white/70 px-3 py-2",
        "dark:border-white/[0.08] dark:bg-white/[0.04]",
      )}
    >
      <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      <span className="text-[14px] font-semibold tabular-nums tracking-tight">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
      {isPaused && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
          <Pause className="h-2.5 w-2.5" />
          Paused
        </span>
      )}
    </div>
  );
}
