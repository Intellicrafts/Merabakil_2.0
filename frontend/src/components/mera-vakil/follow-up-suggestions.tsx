"use client";

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
      className="ml-10 mt-1 border-t border-black/[0.05] pt-3 dark:border-white/[0.06]"
      aria-label="Suggested follow-up questions"
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/50">
        Continue
      </p>
      <div className="space-y-0.5">
        {visible.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion)}
            className="group flex w-full items-start gap-2 py-1 text-left text-[12.5px] leading-snug text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <span className="mt-0.5 shrink-0 text-[11px] text-muted-foreground/30 transition-colors group-hover:text-slate-400">
              →
            </span>
            <span>{suggestion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
