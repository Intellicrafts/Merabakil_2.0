"use client";

import { Loader2, Sparkles, Square } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PROMPT_STARTERS = [
  "Summarize the key obligations in this document.",
  "What are the termination and notice provisions?",
  "List liability caps and indemnity clauses.",
] as const;

interface DocumentQueryDockProps {
  query: string;
  onQueryChange: (value: string) => void;
  isStreaming: boolean;
  error?: string | null;
  onRun: () => void;
  onStop: () => void;
}

export function DocumentQueryDock({
  query,
  onQueryChange,
  isStreaming,
  error,
  onRun,
  onStop,
}: DocumentQueryDockProps) {
  const canRun = query.trim().length >= 3 && !isStreaming;

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-black/[0.06] bg-white/60 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.04)] backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "lg:sticky lg:top-20",
        "dc-card-in",
      )}
      style={{ animationDelay: "40ms" }}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Ask this document
        </h2>
      </div>

      <Textarea
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="What would you like to know about this file?"
        rows={5}
        className="min-h-[120px] resize-y rounded-xl border-black/[0.08] bg-white/80 text-[13px] leading-relaxed dark:border-white/10 dark:bg-white/[0.04]"
        disabled={isStreaming}
      />

      <div className="flex flex-wrap gap-1.5">
        {PROMPT_STARTERS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={isStreaming}
            onClick={() => onQueryChange(prompt)}
            className="rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04]"
          >
            {prompt.length > 42 ? `${prompt.slice(0, 42)}…` : prompt}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="dc-btn-soft h-10 flex-1 rounded-xl text-[13px] font-semibold"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            disabled={!canRun}
            onClick={onRun}
            className="dc-btn-accent h-10 flex-1 rounded-xl text-[13px] font-semibold"
          >
            <Sparkles className="h-4 w-4" />
            Run scoped research
          </button>
        )}
      </div>

      {isStreaming && (
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Analyzing passages…
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
