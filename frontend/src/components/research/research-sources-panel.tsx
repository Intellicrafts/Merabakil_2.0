"use client";

import { ExternalLink } from "lucide-react";

import type { ResearchResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ResearchSourcesPanelProps {
  result: ResearchResponse;
}

export function ResearchSourcesPanel({ result }: ResearchSourcesPanelProps) {
  const hasCitations = result.citations.length > 0;
  const hasWebCitations = result.web_sources.length > 0;
  const hasSources = result.sources.length > 0;
  if (!hasCitations && !hasWebCitations && !hasSources) return null;

  return (
    <div className="space-y-4">
      {hasCitations && (
        <section
          className={cn(
            "rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
            "dark:border-white/[0.08] dark:bg-white/[0.035]",
            "rc-card-in",
          )}
          style={{ animationDelay: "60ms" }}
        >
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            KB Citations · {result.citations.length}
          </h2>
          <ul className="space-y-2">
            {result.citations.map((cite) => (
              <li
                key={`${cite.marker}-${cite.document_id}`}
                className="flex items-start gap-2.5 rounded-xl border border-black/[0.05] bg-white/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <span className="shrink-0 rounded-md border border-slate-300/70 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200">
                  {cite.marker}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{cite.title ?? cite.document_id}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {[cite.citation, cite.section && `Section ${cite.section}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasWebCitations && (
        <section
          className={cn(
            "rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
            "dark:border-white/[0.08] dark:bg-white/[0.035]",
            "rc-card-in",
          )}
          style={{ animationDelay: "80ms" }}
        >
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Web Citations · {result.web_sources.length}
          </h2>
          <ul className="space-y-2">
            {result.web_sources.map((src, idx) => (
              <li
                key={src.url}
                className="flex items-start gap-2.5 rounded-xl border border-black/[0.05] bg-white/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <span className="shrink-0 rounded-md border border-blue-300/70 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:border-blue-400/30 dark:bg-blue-900/20 dark:text-blue-300">
                  {`[WEB-${idx + 1}]`}
                </span>
                <div className="min-w-0 flex-1">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center gap-1 text-[13px] font-medium hover:underline"
                  >
                    {src.title}
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
                  </a>
                  {src.snippet && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {src.snippet}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasSources && (
        <section
          className={cn(
            "rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
            "dark:border-white/[0.08] dark:bg-white/[0.035]",
            "rc-card-in",
          )}
          style={{ animationDelay: "100ms" }}
        >
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Sources · {result.sources.length}
          </h2>
          <ul className="space-y-2.5">
            {result.sources.map((source, idx) => (
              <li
                key={source.chunk_id}
                className="rounded-xl border border-black/[0.05] bg-white/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-medium">
                    [{idx + 1}] {source.title ?? source.document_id}
                  </p>
                  <span className="rounded-full border border-black/[0.06] px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground dark:border-white/10">
                    {source.retrieval}
                  </span>
                </div>
                <div className="mb-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  {source.citation && <span>{source.citation}</span>}
                  {source.section && <span>Section {source.section}</span>}
                  {source.doc_type && <span>{source.doc_type}</span>}
                  <span className="tabular-nums">score {source.score.toFixed(3)}</span>
                </div>
                <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                  {source.content}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
