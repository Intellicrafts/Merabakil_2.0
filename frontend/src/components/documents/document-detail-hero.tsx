"use client";

import { FileText, Layers } from "lucide-react";

import { formatDocStatus, docTypeLabel } from "@/lib/demo-documents";
import type { UserDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DocumentDetailHeroProps {
  document: UserDocument;
}

export function DocumentDetailHero({ document }: DocumentDetailHeroProps) {
  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white/55 backdrop-blur-xl",
        "px-4 py-4 sm:rounded-3xl sm:px-6 sm:py-5",
        "dark:border-white/[0.08] dark:bg-white/[0.03]",
        "dc-card-in",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px dc-shimmer-line" />
      <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-slate-400/15 blur-3xl dc-hero-glow dark:bg-slate-300/10" />

      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-slate-100 dark:border-white/10 dark:bg-white/[0.06]">
            <FileText className="h-5 w-5 text-slate-600 dark:text-slate-300" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Document Q&amp;A
            </p>
            <h1 className="mt-0.5 truncate text-[1.2rem] font-semibold tracking-tight sm:text-[1.4rem]">
              {document.title}
            </h1>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {[docTypeLabel(document.doc_type), document.page_count != null && `${document.page_count} pages`]
                .filter(Boolean)
                .join(" · ") || "Scoped research"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] capitalize text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
            <span className="dc-live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {formatDocStatus(document.status)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]">
            <Layers className="h-3 w-3" strokeWidth={1.75} />
            Passage citations
          </span>
        </div>
      </div>
    </header>
  );
}
