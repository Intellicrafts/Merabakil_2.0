"use client";

import { BookMarked } from "lucide-react";

import type { LegalAuthority } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface CitationsPanelProps {
  authorities: LegalAuthority[];
}

export function CitationsPanel({ authorities }: CitationsPanelProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "cs-card-in",
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <BookMarked className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Legal authorities · {authorities.length}
        </h2>
      </div>
      {authorities.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Authorities cited during hearing appear here.</p>
      ) : (
        <ul className="space-y-2">
          {authorities.map((auth) => (
            <li
              key={auth.id}
              className="flex gap-2 rounded-xl border border-black/[0.05] bg-white/50 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.03]"
            >
              <span className="shrink-0 rounded-md border border-stone-300/60 bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200">
                {auth.marker}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-medium">{auth.title}</p>
                <p className="text-[11px] text-muted-foreground">{auth.citation}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
