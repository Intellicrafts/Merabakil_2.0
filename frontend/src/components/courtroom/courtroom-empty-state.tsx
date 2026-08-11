"use client";

import { Gavel } from "lucide-react";

import { cn } from "@/lib/utils";

export function CourtroomEmptyState() {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-stone-300/60 bg-stone-50/50 px-4 py-14 text-center",
        "dark:border-white/12 dark:bg-white/[0.02]",
        "cs-card-in",
      )}
    >
      <Gavel className="mx-auto mb-3 h-9 w-9 text-stone-500/70" strokeWidth={1.5} />
      <p className="text-[14px] font-semibold tracking-tight">Ready to convene the bench</p>
      <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-muted-foreground">
        Select a starter case or configure parties, then press Start Hearing. The simulation will
        stream a live transcript with procedural directions from the Judge AI.
      </p>
    </div>
  );
}
