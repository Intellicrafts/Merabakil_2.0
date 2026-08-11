"use client";

import { ConfidenceMeter } from "@/components/confidence-meter";
import type { ResearchResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DocumentAnswerPanelProps {
  result: ResearchResponse | null;
  streamedAnswer: string;
  isStreaming: boolean;
}

export function DocumentAnswerPanel({
  result,
  streamedAnswer,
  isStreaming,
}: DocumentAnswerPanelProps) {
  const answer = result?.answer || streamedAnswer;
  if (!answer && !isStreaming) return null;

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border border-black/[0.06] bg-white/65 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.04)] backdrop-blur-xl sm:p-5",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "dc-card-in",
      )}
    >
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Assessment
      </h2>

      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90 sm:text-[14px]">
        {answer}
        {isStreaming && !result && (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-slate-500 align-middle" />
        )}
      </p>

      {result?.confidence && (
        <div className="grid gap-3 rounded-xl border border-black/[0.05] bg-slate-50/80 p-3 sm:grid-cols-2 dark:border-white/[0.06] dark:bg-white/[0.03]">
          <ConfidenceMeter label="Overall confidence" value={result.confidence.overall} />
          <ConfidenceMeter label="Coverage" value={result.confidence.coverage} />
          <ConfidenceMeter label="Retrieval strength" value={result.confidence.retrieval_strength} />
          <ConfidenceMeter label="Source agreement" value={result.confidence.source_agreement} />
        </div>
      )}

      {result?.disclaimer && (
        <p className="rounded-xl border border-black/[0.05] bg-white/50 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground dark:border-white/[0.06] dark:bg-white/[0.03]">
          {result.disclaimer}
        </p>
      )}
    </div>
  );
}
