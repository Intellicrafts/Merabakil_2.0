"use client";

import { useState } from "react";
import { BookOpen, Layers, Loader2, RefreshCw } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatKnowledgeStatus, jobStatusTone } from "@/lib/knowledge-ui";
import type { KnowledgeDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KnowledgeCorpusGridProps {
  documents: KnowledgeDocument[];
  filterTypes: string[];
  activeFilter: string | null;
  onFilterChange: (docType: string | null) => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onReindex?: (documentId: string) => Promise<void> | void;
  reindexingId?: string | null;
}

export function KnowledgeCorpusGrid({
  documents,
  filterTypes,
  activeFilter,
  onFilterChange,
  isLoading,
  isError,
  errorMessage,
  onReindex,
  reindexingId = null,
}: KnowledgeCorpusGridProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Indexed corpus
            {!isLoading && documents.length > 0 ? ` · ${documents.length}` : ""}
          </h2>
        </div>

        {filterTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onFilterChange(null)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                !activeFilter
                  ? "border-slate-400/50 bg-slate-700 text-slate-50 dark:border-white/25 dark:bg-slate-200 dark:text-slate-900"
                  : "border-black/[0.06] bg-white/70 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]",
              )}
            >
              All
            </button>
            {filterTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => onFilterChange(type)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors",
                  activeFilter === type
                    ? "border-slate-400/50 bg-slate-700 text-slate-50 dark:border-white/25 dark:bg-slate-200 dark:text-slate-900"
                    : "border-black/[0.06] bg-white/70 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]",
                )}
              >
                {type.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-black/[0.06] bg-white/50 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]"
            >
              <Skeleton className="mb-3 h-10 w-10 rounded-xl" />
              <Skeleton className="mb-2 h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-[13px] text-red-700 dark:text-red-300">
          {errorMessage ?? "Could not load corpus."}
        </p>
      )}

      {!isLoading && !isError && documents.length === 0 && (
        <div
          className={cn(
            "rounded-2xl border border-dashed border-black/[0.1] bg-white/40 px-4 py-12 text-center",
            "dark:border-white/12 dark:bg-white/[0.02]",
            "kc-card-in",
          )}
        >
          <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/70" strokeWidth={1.5} />
          <p className="text-[13px] font-medium">No documents in the corpus yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {activeFilter
              ? "Try another filter, or ingest a document into this category."
              : "Ingest a PDF or TXT file to start building the library."}
          </p>
        </div>
      )}

      {!isLoading && documents.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc, index) => {
            const busy = reindexingId === doc.document_id;
            const confirming = confirmId === doc.document_id;
            return (
              <article
                key={doc.document_id}
                style={{ animationDelay: `${40 + index * 40}ms` }}
                className={cn(
                  "relative flex flex-col rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
                  "transition-all duration-300 ease-out",
                  "hover:border-slate-300/70 hover:bg-white/90",
                  "hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]",
                  "dark:border-white/[0.08] dark:bg-white/[0.04]",
                  "dark:hover:border-white/20 dark:hover:bg-white/[0.07]",
                  "kc-card-in",
                )}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px kc-shimmer-line opacity-60" />

                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.06] bg-slate-100 dark:border-white/10 dark:bg-white/[0.06]">
                    <BookOpen className="h-4 w-4 text-slate-600 dark:text-slate-300" strokeWidth={1.75} />
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                      jobStatusTone(doc.status),
                    )}
                  >
                    {formatKnowledgeStatus(doc.status)}
                  </span>
                </div>

                <h3 className="line-clamp-2 text-[14px] font-semibold tracking-tight">{doc.title}</h3>
                <p className="mt-1.5 text-[11px] capitalize text-muted-foreground">
                  {[doc.doc_type.replace(/_/g, " "), doc.jurisdiction, `${doc.chunk_count} chunks`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {doc.content_hash && (
                  <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                    hash {doc.content_hash.slice(0, 12)}…
                  </p>
                )}

                {onReindex && doc.status === "indexed" && (
                  <div className="mt-3 border-t border-black/[0.05] pt-3 dark:border-white/10">
                    {confirming ? (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground">
                          Re-embed and replace index entries for this document?
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              await onReindex(doc.document_id);
                              setConfirmId(null);
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 text-[11px] font-semibold text-white dark:bg-slate-200 dark:text-slate-900"
                          >
                            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => setConfirmId(null)}
                            className="h-8 rounded-lg border border-black/[0.08] px-2.5 text-[11px] font-semibold dark:border-white/15"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmId(doc.document_id)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-black/[0.08] px-2.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground dark:border-white/15"
                      >
                        {busy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Re-index
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
