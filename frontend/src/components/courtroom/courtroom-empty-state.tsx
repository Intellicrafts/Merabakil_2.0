"use client";

import { Gavel } from "lucide-react";

import { cn } from "@/lib/utils";

interface CourtroomEmptyStateProps {
  hasPastRuns?: boolean;
}

export function CourtroomEmptyState({ hasPastRuns = false }: CourtroomEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-stone-300/60 bg-stone-50/50 px-4 py-10 text-center sm:py-12",
        "dark:border-white/12 dark:bg-white/[0.02]",
        "cs-card-in",
      )}
    >
      <Gavel className="mx-auto mb-3 h-9 w-9 text-stone-500/70" strokeWidth={1.5} />
      <p className="text-[14px] font-semibold tracking-tight">Ready to convene the bench</p>
      <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-muted-foreground">
        {hasPastRuns
          ? "Prepare a new matter above, or review a past simulation below."
          : "Select a starter case or configure parties, then build agents and start the hearing. Completed runs will appear here on this device."}
      </p>
    </div>
  );
}
