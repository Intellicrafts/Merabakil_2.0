"use client";

import type { TranscriptLanguage } from "@/lib/courtroom/types";
import { languageLabel } from "@/lib/courtroom/bilingual";
import { cn } from "@/lib/utils";

const OPTIONS: TranscriptLanguage[] = ["en", "hi", "both"];

interface CourtroomLanguageToggleProps {
  value: TranscriptLanguage;
  onChange: (value: TranscriptLanguage) => void;
}

export function CourtroomLanguageToggle({ value, onChange }: CourtroomLanguageToggleProps) {
  return (
    <div
      className="inline-flex rounded-xl border border-black/[0.06] bg-white/55 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.03]"
      role="group"
      aria-label="Argument language"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
            value === opt
              ? "bg-stone-700 text-stone-50 dark:bg-stone-200 dark:text-stone-900"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {languageLabel(opt)}
        </button>
      ))}
    </div>
  );
}
