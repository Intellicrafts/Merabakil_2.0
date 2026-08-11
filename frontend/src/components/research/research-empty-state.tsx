"use client";

import { BookOpen } from "lucide-react";

import { RESEARCH_STARTER_PROMPTS } from "@/lib/research-history";
import { cn } from "@/lib/utils";

interface ResearchEmptyStateProps {
  onPickPrompt: (prompt: string) => void;
  disabled?: boolean;
}

export function ResearchEmptyState({ onPickPrompt, disabled }: ResearchEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/[0.08] px-6 py-14 text-center",
        "bg-white/40 dark:border-white/10 dark:bg-white/[0.02]",
        "rc-card-in",
      )}
      style={{ animationDelay: "80ms" }}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-black/[0.06] bg-white/80 dark:border-white/10 dark:bg-white/[0.06]">
        <BookOpen className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
        Ask a question to get a grounded answer with citations, confidence metrics, and live
        agent stages.
      </p>
      <div className="mt-5 flex max-w-lg flex-wrap justify-center gap-2">
        {RESEARCH_STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onPickPrompt(prompt)}
            className="rounded-full border border-black/[0.06] bg-white/70 px-3 py-1.5 text-left text-[11px] font-medium text-muted-foreground transition-colors hover:border-slate-300 hover:text-foreground disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.04]"
          >
            {prompt.length > 56 ? `${prompt.slice(0, 56)}…` : prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
