"use client";

import type { ResearchResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DocumentPassagesPanelProps {
  result: ResearchResponse;
}

export function DocumentPassagesPanel({ result }: DocumentPassagesPanelProps) {
  if (!result.sources.length) return null;

  return (
    <section
      className={cn(
        "rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "dc-card-in",
      )}
      style={{ animationDelay: "80ms" }}
    >
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Passages · {result.sources.length}
      </h2>
      <ul className="space-y-2.5">
        {result.sources.map((source, idx) => (
          <li
            key={source.chunk_id}
            className="rounded-xl border border-black/[0.05] bg-white/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]"
          >
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-medium">
                [{idx + 1}] {source.section ?? source.title ?? "excerpt"}
              </p>
              <span className="rounded-full border border-black/[0.06] px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground dark:border-white/10">
                {source.score.toFixed(3)}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{source.content}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
