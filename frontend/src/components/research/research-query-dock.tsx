"use client";

import { Clock, Search, Sparkles, Square } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ResearchQueryDockProps {
  query: string;
  jurisdiction: string;
  history: string[];
  isStreaming: boolean;
  error?: string | null;
  onQueryChange: (value: string) => void;
  onJurisdictionChange: (value: string) => void;
  onRun: () => void;
  onStop: () => void;
  onPickHistory: (item: string) => void;
}

export function ResearchQueryDock({
  query,
  jurisdiction,
  history,
  isStreaming,
  error,
  onQueryChange,
  onJurisdictionChange,
  onRun,
  onStop,
  onPickHistory,
}: ResearchQueryDockProps) {
  const canRun = query.trim().length >= 3 && !isStreaming;

  return (
    <div
      className={cn(
        "space-y-3 rounded-2xl border border-black/[0.06] bg-white/60 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.04)] backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "lg:sticky lg:top-20",
        "rc-card-in",
      )}
      style={{ animationDelay: "40ms" }}
    >
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Ask
        </h2>
      </div>

      <Textarea
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Describe your legal question or matter…"
        rows={5}
        className="min-h-[120px] resize-y rounded-xl border-black/[0.08] bg-white/80 text-[13px] leading-relaxed dark:border-white/10 dark:bg-white/[0.04]"
        disabled={isStreaming}
      />

      <Input
        value={jurisdiction}
        onChange={(e) => onJurisdictionChange(e.target.value)}
        placeholder="Jurisdiction (optional) · e.g. Maharashtra"
        className="h-10 rounded-xl border-black/[0.08] bg-white/80 text-[13px] dark:border-white/10 dark:bg-white/[0.04]"
        disabled={isStreaming}
      />

      <div className="flex gap-2">
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="rc-btn-soft h-10 flex-1 rounded-xl text-[13px] font-semibold"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            Stop
          </button>
        ) : (
          <button
            type="button"
            disabled={!canRun}
            onClick={onRun}
            className="rc-btn-accent h-10 flex-1 rounded-xl text-[13px] font-semibold"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Run research
          </button>
        )}
      </div>

      {error && <p className="text-[12px] text-destructive">{error}</p>}

      {history.length > 0 && (
        <div className="space-y-2 border-t border-black/[0.05] pt-3 dark:border-white/[0.06]">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Clock className="h-3 w-3" />
            Recent
          </div>
          <div className="flex flex-col gap-1">
            {history.map((item) => (
              <button
                key={item}
                type="button"
                disabled={isStreaming}
                onClick={() => onPickHistory(item)}
                className="w-full rounded-lg px-2.5 py-1.5 text-left text-[11px] leading-snug text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground disabled:opacity-50 dark:hover:bg-white/[0.06]"
              >
                {item.length > 90 ? `${item.slice(0, 90)}…` : item}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
