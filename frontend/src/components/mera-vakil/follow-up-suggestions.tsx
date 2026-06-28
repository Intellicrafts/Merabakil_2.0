"use client";

import { Sparkles } from "lucide-react";

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function FollowUpSuggestions({
  suggestions,
  onSelect,
  disabled,
}: FollowUpSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="mt-4 space-y-2" aria-label="Suggested follow-up questions">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Continue the conversation
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion)}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/50 px-3 py-1.5 text-left text-xs text-foreground/90 transition-all hover:border-black/[0.1] hover:bg-white/80 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            <Sparkles className="h-3 w-3 shrink-0 text-slate-500" />
            <span className="line-clamp-2">{suggestion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
