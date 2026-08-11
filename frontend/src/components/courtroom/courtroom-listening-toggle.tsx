"use client";

import { Ear, EarOff } from "lucide-react";

import { cn } from "@/lib/utils";

interface CourtroomListeningToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function CourtroomListeningToggle({
  enabled,
  onChange,
  disabled,
}: CourtroomListeningToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold transition-colors",
        enabled
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
          : "border-black/[0.06] bg-white/55 text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.03]",
      )}
      aria-pressed={enabled}
    >
      {enabled ? <Ear className="h-3.5 w-3.5" /> : <EarOff className="h-3.5 w-3.5" />}
      {enabled ? "Listening ON" : "Listening OFF"}
    </button>
  );
}
