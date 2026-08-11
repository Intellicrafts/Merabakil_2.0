"use client";

import { Inbox, RefreshCw } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatKnowledgeStatus,
  isJobActive,
  jobProgress,
  jobStatusTone,
} from "@/lib/knowledge-ui";
import type { IngestionJob } from "@/lib/types";
import { cn } from "@/lib/utils";

interface KnowledgeJobsPanelProps {
  jobs: IngestionJob[];
  isLoading?: boolean;
  isError?: boolean;
  onRefresh: () => void;
}

export function KnowledgeJobsPanel({
  jobs,
  isLoading,
  isError,
  onRefresh,
}: KnowledgeJobsPanelProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Ingestion jobs
          {jobs.length > 0 ? ` · ${jobs.length}` : ""}
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          className="kc-btn-soft h-8 rounded-lg px-2.5 text-[12px] font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {isLoading && jobs.length === 0 && (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}

      {isError && jobs.length === 0 && (
        <p className="rounded-xl border border-black/[0.06] bg-white/50 px-3 py-3 text-[13px] text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.03]">
          Job list unavailable. Active uploads are still tracked locally.
        </p>
      )}

      {!isLoading && jobs.length === 0 && !isError && (
        <div
          className={cn(
            "rounded-2xl border border-dashed border-black/[0.1] bg-white/40 px-4 py-12 text-center",
            "dark:border-white/12 dark:bg-white/[0.02]",
            "kc-card-in",
          )}
        >
          <Inbox className="mx-auto mb-2 h-8 w-8 text-muted-foreground/70" strokeWidth={1.5} />
          <p className="text-[13px] font-medium">No jobs yet</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Large uploads appear here while indexing runs.
          </p>
        </div>
      )}

      {jobs.length > 0 && (
        <ul className="space-y-2.5">
          {jobs.map((job, index) => {
            const active = isJobActive(job.status);
            return (
              <li
                key={job.job_id}
                style={{ animationDelay: `${40 + index * 40}ms` }}
                className={cn(
                  "rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
                  "dark:border-white/[0.08] dark:bg-white/[0.04]",
                  "kc-card-in",
                )}
              >
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold tracking-tight">
                      {job.title || job.job_id}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {[job.doc_type && job.doc_type.replace(/_/g, " "), job.job_id.slice(0, 8)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
                      jobStatusTone(job.status),
                    )}
                  >
                    {active && <span className="kc-live-dot h-1.5 w-1.5 rounded-full bg-amber-500" />}
                    {formatKnowledgeStatus(job.status)}
                  </span>
                </div>

                <Progress
                  value={jobProgress(job.status)}
                  className="h-1.5"
                  indicatorClassName={
                    job.status === "failed"
                      ? "bg-red-500"
                      : job.status === "indexed"
                        ? "bg-emerald-500"
                        : "bg-slate-500"
                  }
                />

                {job.chunk_count > 0 && (
                  <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
                    {job.chunk_count} chunks
                  </p>
                )}

                {job.error && (
                  <p className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-700 dark:text-red-300">
                    {job.error}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
