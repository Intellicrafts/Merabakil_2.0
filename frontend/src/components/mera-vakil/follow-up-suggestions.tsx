"use client";

import { ArrowUpRight, Sparkles } from "lucide-react";

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
  const visible = suggestions.slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div
      className="mv-followups mt-1"
      aria-label="Suggested follow-up questions"
    >
      <div className="mv-followups-heading">
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        <span>Continue exploring</span>
      </div>
      <div className="mv-followups-list">
        {visible.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion)}
            className="mv-followup-action group"
          >
            <span className="mv-followup-action-text">{suggestion}</span>
            <ArrowUpRight
              className="mv-followup-action-icon h-3.5 w-3.5 shrink-0"
              strokeWidth={1.8}
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  );
}
