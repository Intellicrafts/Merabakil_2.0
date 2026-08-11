"use client";

import { FileText } from "lucide-react";

import type { Exhibit } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface EvidencePanelProps {
  exhibits: Exhibit[];
}

export function EvidencePanel({ exhibits }: EvidencePanelProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "cs-card-in",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Exhibits · {exhibits.length}
        </h2>
      </div>
      {exhibits.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">No exhibits on record.</p>
      ) : (
        <ul className="space-y-2">
          {exhibits.map((ex) => (
            <li
              key={ex.id}
              className="rounded-xl border border-black/[0.05] bg-white/50 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
            >
              <p className="text-[12px] font-medium">{ex.title}</p>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                <span>{ex.type}</span>
                {ex.source && <span>· {ex.source}</span>}
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 font-semibold capitalize",
                    ex.status === "admitted"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : ex.status === "marked"
                        ? "border-stone-400/30 bg-stone-100 text-stone-700 dark:border-white/15 dark:bg-white/10"
                        : "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-300",
                  )}
                >
                  {ex.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
