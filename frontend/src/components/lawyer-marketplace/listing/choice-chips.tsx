"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** Multi-select chips. Each chip is a toggle button (aria-pressed); the
 *  surrounding FormField (group) names the set and carries its error. */
export function ChoiceChips({
  options,
  selected,
  onToggle,
  invalid,
  disabled,
}: {
  options: readonly string[];
  selected: string[];
  onToggle: (option: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5 rounded-xl", invalid && "ring-1 ring-red-300 ring-offset-2 dark:ring-red-800")}>
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(option)}
            className={cn(
              "inline-flex min-h-8 items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              on
                ? "border-slate-400/60 bg-slate-100 text-foreground dark:border-white/25 dark:bg-white/15"
                : "border-black/[0.08] text-muted-foreground hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]",
            )}
          >
            {on && <Check className="h-3 w-3 shrink-0" aria-hidden />}
            {option}
          </button>
        );
      })}
    </div>
  );
}
