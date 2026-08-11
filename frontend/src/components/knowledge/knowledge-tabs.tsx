"use client";

import { cn } from "@/lib/utils";

export type KnowledgeTab = "ingest" | "jobs" | "corpus" | "graph";

const TABS: { id: KnowledgeTab; label: string }[] = [
  { id: "ingest", label: "Ingest" },
  { id: "jobs", label: "Jobs" },
  { id: "corpus", label: "Corpus" },
  { id: "graph", label: "Graph" },
];

interface KnowledgeTabsProps {
  value: KnowledgeTab;
  onChange: (tab: KnowledgeTab) => void;
  jobBadge?: number;
}

export function KnowledgeTabs({ value, onChange, jobBadge }: KnowledgeTabsProps) {
  return (
    <div
      className={cn(
        "inline-flex w-full gap-1 rounded-2xl border border-black/[0.06] bg-white/55 p-1 backdrop-blur-xl sm:w-auto",
        "dark:border-white/[0.08] dark:bg-white/[0.03]",
        "kc-card-in",
      )}
      role="tablist"
    >
      {TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all sm:flex-none sm:min-w-[100px]",
              active
                ? "bg-slate-700 text-slate-50 shadow-sm dark:bg-slate-200 dark:text-slate-900"
                : "text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/[0.06]",
            )}
          >
            {tab.label}
            {tab.id === "jobs" && typeof jobBadge === "number" && jobBadge > 0 && (
              <span
                className={cn(
                  "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  active
                    ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900"
                    : "bg-amber-500/15 text-amber-800 dark:text-amber-300",
                )}
              >
                {jobBadge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
