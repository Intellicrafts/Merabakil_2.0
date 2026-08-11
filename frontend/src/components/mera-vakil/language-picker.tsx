"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Waves } from "lucide-react";

import { INDIAN_SPEECH_LOCALES } from "@/lib/indian-locales";
import { cn } from "@/lib/utils";

interface LanguagePickerProps {
  value: string;
  onChange: (code: string) => void;
}

export function LanguagePicker({ value, onChange }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected =
    INDIAN_SPEECH_LOCALES.find((l) => l.code === value) ?? INDIAN_SPEECH_LOCALES[0];

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select read-aloud language"
        className={cn(
          "group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 text-left transition-all duration-300",
          "border-black/[0.06] bg-white/70 shadow-[0_2px_12px_rgba(15,23,42,0.05)] backdrop-blur-md",
          "hover:border-slate-300/50 hover:bg-white/90 hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)]",
          "dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-white/20 dark:hover:bg-white/[0.09]",
          open && "border-slate-400/40 ring-2 ring-slate-400/20 dark:border-white/25",
        )}
      >
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <span className="mv-lang-ring absolute inset-0 rounded-full opacity-70" />
          <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
            <Waves className="h-3.5 w-3.5" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Voice language
          </p>
          <p className="truncate text-sm font-semibold tracking-tight">{selected.label}</p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Read-aloud languages"
          className="mv-lang-menu absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-56 overflow-y-auto rounded-2xl border border-black/[0.08] bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/95"
        >
          {INDIAN_SPEECH_LOCALES.map((locale, idx) => {
            const active = locale.code === value;
            return (
              <button
                key={locale.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(locale.code);
                  setOpen(false);
                }}
                style={{ animationDelay: `${idx * 30}ms` }}
                className={cn(
                  "mv-lang-item flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  active
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase",
                    active
                      ? "bg-white/15 dark:bg-black/10"
                      : "bg-black/[0.04] dark:bg-white/[0.06]",
                  )}
                >
                  {locale.label.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{locale.label}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
