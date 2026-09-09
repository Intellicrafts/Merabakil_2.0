"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Waves } from "lucide-react";

import { useAnchoredOverlay } from "@/components/ui/use-anchored-overlay";
import { INDIAN_SPEECH_LOCALES } from "@/lib/indian-locales";
import { cn } from "@/lib/utils";

interface LanguagePickerProps {
  value: string;
  onChange: (code: string) => void;
  compact?: boolean;
}

export function LanguagePicker({ value, onChange, compact = false }: LanguagePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { layout, mounted } = useAnchoredOverlay(open, triggerRef, {
    minWidth: compact ? 220 : 240,
    maxMenuHeight: 320,
    align: compact ? "end" : "start",
  });
  const selected =
    INDIAN_SPEECH_LOCALES.find((l) => l.code === value) ?? INDIAN_SPEECH_LOCALES[0];

  const menu =
    open && mounted && layout
      ? createPortal(
          <div className="ui-select-layer" data-mode={layout.mode}>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Close language menu"
              className={cn("ui-select-veil", layout.mode === "popover" && "bg-transparent")}
              onClick={() => setOpen(false)}
            />
            <div
              role="listbox"
              aria-label="Read-aloud languages"
              style={
                layout.mode === "popover"
                  ? {
                      top: layout.top,
                      bottom: layout.bottom,
                      left: layout.left,
                      width: layout.width,
                      maxHeight: layout.maxHeight,
                    }
                  : undefined
              }
              className={cn(
                "ui-select-menu",
                layout.mode === "sheet" ? "ui-select-sheet" : "ui-select-popover",
              )}
            >
              {layout.mode === "sheet" && (
                <div className="mb-2 flex flex-col items-center pt-1">
                  <span className="ui-select-handle" />
                  <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Voice language
                  </p>
                </div>
              )}
              <div className="ui-select-list">
                {INDIAN_SPEECH_LOCALES.map((locale) => {
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
                      className={cn("ui-select-option", active && "ui-select-option-active")}
                    >
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase",
                          active
                            ? "bg-primary/15 text-foreground"
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
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cn("relative", compact && "inline-flex")}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select read-aloud language"
        className={cn(
          compact
            ? cn(
                "flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors",
                "hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10",
                "md:h-8 md:w-8",
                open && "bg-black/[0.05] text-foreground dark:bg-white/10",
              )
            : cn(
                "ui-select-trigger h-auto min-h-12 rounded-2xl py-2.5 pr-3",
                open && "ui-select-trigger-open",
              ),
        )}
      >
        {compact ? (
          <Waves className="h-[18px] w-[18px] md:h-4 md:w-4" strokeWidth={1.75} />
        ) : (
          <>
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
              <span className="mv-lang-ring absolute inset-0 rounded-full opacity-70" />
              <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
                <Waves className="h-3.5 w-3.5" />
              </span>
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Voice language
              </p>
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">{selected.label}</p>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
                open && "rotate-180",
              )}
            />
          </>
        )}
      </button>
      {menu}
    </div>
  );
}
