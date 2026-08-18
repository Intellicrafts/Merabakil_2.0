"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { ConfidenceMeter } from "@/components/confidence-meter";
import type { ResearchResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ResearchAnswerPanelProps {
  result: ResearchResponse | null;
  streamedAnswer: string;
  isStreaming: boolean;
  onPickSuggestion?: (text: string) => void;
}

export function ResearchAnswerPanel({
  result,
  streamedAnswer,
  isStreaming,
  onPickSuggestion,
}: ResearchAnswerPanelProps) {
  const [specialistOpen, setSpecialistOpen] = useState(false);
  const answer = result?.answer || streamedAnswer;
  if (!answer && !isStreaming) return null;

  const confidence = result?.confidence;
  const hasSpecialist =
    result && result.specialist_payload && Object.keys(result.specialist_payload).length > 0;

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-black/[0.06] bg-white/65 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.04)] backdrop-blur-xl sm:p-5",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "rc-card-in",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Assessment
        </h2>
        {result && (
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-slate-300/70 bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold capitalize text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200">
              {result.intent.replace(/_/g, " ")}
            </span>
            <span className="rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
              {result.jurisdiction.level}
              {result.jurisdiction.region ? ` · ${result.jurisdiction.region}` : ""}
            </span>
          </div>
        )}
      </div>

      <div className="relative">
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90 sm:text-[14px]">
          {answer}
          {isStreaming && !result && (
            <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-slate-500 align-middle" />
          )}
        </p>
      </div>

      {confidence && (
        <div className="grid gap-3 rounded-xl border border-black/[0.05] bg-slate-50/80 p-3 sm:grid-cols-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <ConfidenceMeter label="Overall confidence" value={confidence.overall} />
          <ConfidenceMeter label="Retrieval strength" value={confidence.retrieval_strength} />
          <ConfidenceMeter label="Source agreement" value={confidence.source_agreement} />
          <ConfidenceMeter label="Coverage" value={confidence.coverage} />
        </div>
      )}

      {result?.disclaimer && (
        <p className="rounded-xl border border-black/[0.05] bg-white/50 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.03]">
          {result.disclaimer}
        </p>
      )}

      {result?.suggestions && result.suggestions.length > 0 && onPickSuggestion && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Ask next
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onPickSuggestion(s)}
                className="rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasSpecialist && (
        <div className="overflow-hidden rounded-xl border border-black/[0.05] dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => setSpecialistOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-medium transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.04]"
          >
            <ChevronRight
              className={cn("h-3.5 w-3.5 transition-transform", specialistOpen && "rotate-90")}
            />
            Specialist analysis
          </button>
          {specialistOpen && (
            <pre className="max-h-48 overflow-auto border-t border-black/[0.05] bg-slate-50/80 p-3 text-[11px] dark:border-white/[0.06] dark:bg-white/[0.03]">
              {JSON.stringify(result!.specialist_payload, null, 2)}
            </pre>
          )}
        </div>
      )}

      {result?.trace && result.trace.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.trace.map((step, idx) => (
            <span
              key={`${step}-${idx}`}
              className="rounded-full border border-black/[0.05] bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.04]"
            >
              {step}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
