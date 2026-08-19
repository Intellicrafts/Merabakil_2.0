"use client";

import { useState } from "react";
import { ChevronRight, ExternalLink, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ResearchResponse } from "@/lib/types";

interface ResearchMetadataPanelProps {
  research: ResearchResponse;
  onCitationClick?: (marker: string) => void;
}

function confidenceTone(value: number): string {
  if (value >= 0.66) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 0.33) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export function ResearchMetadataPanel({ research, onCitationClick }: ResearchMetadataPanelProps) {
  const [open, setOpen] = useState(false);

  const sourceCount = research.sources.length;
  const citationCount = research.citations.length;
  const webCount = research.web_sources?.length ?? 0;
  const confidencePct = Math.round(research.confidence.overall * 100);
  const hasMetadata = sourceCount > 0 || citationCount > 0 || webCount > 0;

  if (!hasMetadata) return null;

  const summaryParts = [
    "Sources & grounding",
    confidencePct > 0 ? `${confidencePct}% confidence` : null,
    citationCount > 0 ? `${citationCount} KB citation${citationCount === 1 ? "" : "s"}` : null,
    webCount > 0 ? `${webCount} web source${webCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-xl border border-black/[0.06] bg-white/40 shadow-[0_2px_10px_rgba(15,23,42,0.04)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.03]">
      <button
        type="button"
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
          {summaryParts.join(" · ")}
        </span>
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-90",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-black/[0.05] px-3.5 py-3 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              {research.confidence.overall > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("font-semibold", confidenceTone(research.confidence.overall))}>
                    {confidencePct}%
                  </span>
                  confidence
                </span>
              )}
              <span className="capitalize">{research.intent.replace(/_/g, " ")}</span>
              <span className="capitalize">
                {research.jurisdiction.level}
                {research.jurisdiction.region ? ` · ${research.jurisdiction.region}` : ""}
              </span>
              {webCount > 0 && (
                <span className="text-blue-600 dark:text-blue-400">Web supplemented</span>
              )}
            </div>

            {research.citations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {research.citations.map((cite) => (
                  <button
                    key={`${cite.marker}-${cite.document_id}`}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-black/[0.03] px-2.5 py-1 text-xs text-slate-700 transition-colors hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    onClick={() => onCitationClick?.(cite.marker)}
                    aria-label={`Citation ${cite.marker}: ${cite.title ?? cite.document_id}`}
                  >
                    <span className="font-medium">{cite.marker}</span>
                    <span className="max-w-[180px] truncate">{cite.title ?? cite.document_id}</span>
                  </button>
                ))}
              </div>
            )}

            {webCount > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {research.web_sources.map((src, idx) => (
                  <a
                    key={src.url}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200/70 bg-blue-50/60 px-2.5 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-100/80 dark:border-blue-400/20 dark:bg-blue-900/20 dark:text-blue-300"
                  >
                    <span className="font-medium">{`[WEB-${idx + 1}]`}</span>
                    <span className="max-w-[180px] truncate">{src.title}</span>
                    <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
                  </a>
                ))}
              </div>
            )}

            {research.sources.length > 0 && (
              <div className="space-y-2">
                {research.sources.map((source, idx) => (
                  <div
                    key={source.chunk_id}
                    id={`source-${idx + 1}`}
                    className="rounded-lg bg-black/[0.02] px-3 py-2 text-xs dark:bg-white/[0.03]"
                  >
                    <p className="font-medium text-foreground/80">
                      [{idx + 1}] {source.title ?? source.document_id}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {source.score.toFixed(2)} · {source.retrieval}
                      </span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-muted-foreground">{source.content}</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
