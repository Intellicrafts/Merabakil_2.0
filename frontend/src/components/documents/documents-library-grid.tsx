"use client";

import Link from "next/link";
import { ArrowUpRight, FileText, Files } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { docTypeLabel, formatDocStatus } from "@/lib/demo-documents";
import type { UserDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DocumentsLibraryGridProps {
  documents: UserDocument[];
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s.includes("ready") || s.includes("indexed") || s === "completed") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  }
  if (s.includes("fail") || s.includes("error")) {
    return "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-300";
  }
  if (s.includes("process") || s.includes("pending") || s.includes("index")) {
    return "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-300";
  }
  return "border-slate-300/70 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200";
}

export function DocumentsLibraryGrid({
  documents,
  isLoading,
  isError,
  errorMessage,
}: DocumentsLibraryGridProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Files className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Library
            {!isLoading && documents.length > 0 ? ` · ${documents.length}` : ""}
          </h2>
        </div>
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
          {errorMessage ?? "Could not load documents."}
        </p>
      )}

      {!isLoading && !isError && documents.length === 0 && (
        <div
          className={cn(
            "rounded-2xl border border-dashed border-black/[0.1] bg-white/40 px-4 py-10 text-center",
            "dark:border-white/12 dark:bg-white/[0.02]",
            "dc-card-in",
          )}
        >
          <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/70" strokeWidth={1.5} />
          <p className="text-[13px] font-medium">No documents yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Upload a file above or start from a demo template.
          </p>
        </div>
      )}

      {!isLoading && documents.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc, index) => (
            <Link
              key={doc.document_id}
              href={`/documents/${doc.document_id}`}
              style={{ animationDelay: `${40 + index * 40}ms` }}
              className={cn(
                "group relative flex flex-col rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
                "transition-all duration-300 ease-out",
                "hover:border-slate-300/70 hover:bg-white/90",
                "hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)]",
                "motion-safe:hover:-translate-y-0.5",
                "dark:border-white/[0.08] dark:bg-white/[0.04]",
                "dark:hover:border-white/20 dark:hover:bg-white/[0.07]",
                "dc-card-in",
              )}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px dc-shimmer-line opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.06] bg-slate-100 dark:border-white/10 dark:bg-white/[0.06]">
                  <FileText className="h-4 w-4 text-slate-600 dark:text-slate-300" strokeWidth={1.75} />
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                    statusTone(doc.status),
                  )}
                >
                  {formatDocStatus(doc.status)}
                </span>
              </div>

              <h3 className="line-clamp-2 text-[14px] font-semibold tracking-tight group-hover:underline">
                {doc.title}
              </h3>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {[docTypeLabel(doc.doc_type), doc.page_count != null && `${doc.page_count} pages`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-slate-700 dark:text-slate-200">
                Open Q&amp;A
                <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
