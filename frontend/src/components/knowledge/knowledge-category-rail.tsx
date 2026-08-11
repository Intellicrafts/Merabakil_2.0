"use client";

import { FolderOpen } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KnowledgeCategoryRailProps {
  categories: Category[];
  selected: Category | null;
  onSelect: (category: Category) => void;
  isLoading?: boolean;
}

export function KnowledgeCategoryRail({
  categories,
  selected,
  onSelect,
  isLoading,
}: KnowledgeCategoryRailProps) {
  return (
    <aside
      className={cn(
        "space-y-3 rounded-2xl border border-black/[0.06] bg-white/60 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.04)] backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto",
        "kc-card-in",
      )}
      style={{ animationDelay: "40ms" }}
    >
      <div className="flex items-center gap-2">
        <FolderOpen className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Categories
        </h2>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )}

      {!isLoading && categories.length === 0 && (
        <p className="rounded-xl border border-dashed border-black/[0.1] px-3 py-6 text-center text-[12px] text-muted-foreground dark:border-white/12">
          No categories available.
        </p>
      )}

      <div className="space-y-2">
        {categories.map((cat) => {
          const active = selected?.doc_type === cat.doc_type;
          return (
            <button
              key={cat.doc_type}
              type="button"
              onClick={() => onSelect(cat)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-all",
                active
                  ? "border-slate-400/50 bg-slate-100/90 shadow-sm dark:border-white/20 dark:bg-white/[0.08]"
                  : "border-black/[0.05] bg-white/50 hover:border-slate-300/60 dark:border-white/[0.06] dark:bg-white/[0.03] dark:hover:bg-white/[0.05]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold capitalize tracking-tight">
                  {cat.doc_type.replace(/_/g, " ")}
                </p>
                <span className="shrink-0 rounded-full border border-black/[0.06] bg-white/70 px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
                  {cat.jurisdiction}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                {cat.purpose}
              </p>
              {active && (
                <div className="mt-2 space-y-1 border-t border-black/[0.05] pt-2 text-[11px] text-muted-foreground dark:border-white/[0.06]">
                  <p>{cat.ingestion_tips}</p>
                  <p className="font-medium text-foreground/80">
                    Recommended: {cat.recommended_min_pdfs}–{cat.recommended_optimal_pdfs} PDFs
                  </p>
                  {cat.answers_for.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {cat.answers_for.slice(0, 3).map((a) => (
                        <span
                          key={a}
                          className="rounded-full border border-black/[0.05] bg-slate-50 px-1.5 py-0.5 text-[10px] dark:border-white/[0.08] dark:bg-white/[0.04]"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
