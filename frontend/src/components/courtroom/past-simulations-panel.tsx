"use client";

import { useState } from "react";
import {
  ClipboardList,
  FileText,
  History,
  MessagesSquare,
  Trash2,
} from "lucide-react";

import type { CourtroomRunRecord } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface PastSimulationsPanelProps {
  runs: CourtroomRunRecord[];
  onOpen: (run: CourtroomRunRecord) => void;
  onDelete: (id: string) => void;
}

function formatSavedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function relativeHint(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatSavedAt(iso);
}

export function PastSimulationsPanel({ runs, onOpen, onDelete }: PastSimulationsPanelProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (runs.length === 0) return null;

  return (
    <section
      className={cn(
        "rounded-2xl border border-stone-300/40 bg-white/60 p-4 backdrop-blur-sm sm:p-5",
        "dark:border-white/10 dark:bg-white/[0.03]",
        "cs-card-in",
      )}
      aria-label="Past simulations"
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-stone-300/50 bg-stone-100/80 dark:border-white/10 dark:bg-white/[0.06]">
            <History className="h-4 w-4 text-stone-600 dark:text-stone-300" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold tracking-tight">Past simulations</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Saved on this device — reopen a judgment without re-running the hearing.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-stone-200/80 bg-stone-50 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
          {runs.length}
        </span>
      </div>

      <ul className="mt-3 max-h-[min(52vh,420px)] space-y-2 overflow-y-auto pr-0.5">
        {runs.map((run) => {
          const artifactCount = run.intake?.artifacts?.length ?? 0;
          const hasPlan = Boolean(run.actionPlan);
          const turns = run.transcript?.length ?? 0;
          const confirming = confirmId === run.id;

          return (
            <li key={run.id}>
              <div
                className={cn(
                  "group rounded-xl border border-stone-200/70 bg-stone-50/80 transition-colors",
                  "hover:border-stone-300 hover:bg-white/90",
                  "dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-white/16 dark:hover:bg-white/[0.06]",
                  confirming && "border-red-300/70 bg-red-50/50 dark:border-red-500/30 dark:bg-red-500/5",
                )}
              >
                {confirming ? (
                  <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[12px] leading-relaxed text-stone-700 dark:text-stone-300">
                      Delete this simulation? This only removes the local copy.
                    </p>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onDelete(run.id);
                          setConfirmId(null);
                        }}
                        className="h-9 rounded-xl bg-red-700 px-3 text-[12px] font-semibold text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="cs-btn-soft h-9 rounded-xl px-3 text-[12px] font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={() => onOpen(run)}
                      className="min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-stone-400/50"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13px] font-semibold tracking-tight">
                          {run.config.matterTitle || "Untitled matter"}
                        </p>
                        {run.config.matterType && (
                          <span className="rounded-md border border-stone-200/80 bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
                            {run.config.matterType}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {run.config.petitionerName} v. {run.config.respondentName}
                      </p>
                      <p className="mt-1 line-clamp-1 text-[11px] text-stone-600 dark:text-stone-400">
                        <span className="text-muted-foreground">Held — </span>
                        {run.judgment.disposition}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                        <span title={formatSavedAt(run.savedAt)}>{relativeHint(run.savedAt)}</span>
                        {artifactCount > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {artifactCount} artifact{artifactCount === 1 ? "" : "s"}
                          </span>
                        )}
                        {turns > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <MessagesSquare className="h-3 w-3" />
                            {turns} turns
                          </span>
                        )}
                        {hasPlan && (
                          <span className="inline-flex items-center gap-1 text-amber-800/80 dark:text-amber-200/70">
                            <ClipboardList className="h-3 w-3" />
                            Action plan
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="flex shrink-0 gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => onOpen(run)}
                        className="cs-btn-accent h-9 rounded-xl px-3 text-[12px] font-semibold"
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(run.id)}
                        aria-label={`Delete ${run.config.matterTitle || "simulation"}`}
                        className="cs-btn-soft h-9 rounded-xl px-3 text-[12px] font-semibold text-stone-600 opacity-80 hover:opacity-100 dark:text-stone-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
