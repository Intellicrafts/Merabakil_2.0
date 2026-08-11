"use client";

import { Sparkles } from "lucide-react";

import { DEMO_SESSION_PRESETS } from "@/lib/courtroom/demo-sessions";
import type { CourtroomSessionConfig } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

const MATTER_TYPES = ["Commercial", "Constitutional", "Civil", "Criminal", "Arbitration"] as const;

interface CourtroomSetupPanelProps {
  config: CourtroomSessionConfig;
  onChange: (config: CourtroomSessionConfig) => void;
  onSelectPreset: (presetId: string) => void;
  disabled?: boolean;
}

export function CourtroomSetupPanel({
  config,
  onChange,
  onSelectPreset,
  disabled,
}: CourtroomSetupPanelProps) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl sm:p-5",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "cs-card-in",
      )}
    >
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Matter setup
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-[11px] font-medium text-muted-foreground">Matter title</span>
          <input
            value={config.matterTitle}
            onChange={(e) => onChange({ ...config, matterTitle: e.target.value })}
            disabled={disabled}
            className="h-10 w-full rounded-xl border border-black/[0.08] bg-white/80 px-3 text-[13px] dark:border-white/10 dark:bg-white/[0.04]"
            placeholder="e.g. Sharma Industries v. Delta Logistics"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Petitioner advocate</span>
          <input
            value={config.petitionerName}
            onChange={(e) => onChange({ ...config, petitionerName: e.target.value })}
            disabled={disabled}
            className="h-10 w-full rounded-xl border border-black/[0.08] bg-white/80 px-3 text-[13px] dark:border-white/10 dark:bg-white/[0.04]"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Respondent advocate</span>
          <input
            value={config.respondentName}
            onChange={(e) => onChange({ ...config, respondentName: e.target.value })}
            disabled={disabled}
            className="h-10 w-full rounded-xl border border-black/[0.08] bg-white/80 px-3 text-[13px] dark:border-white/10 dark:bg-white/[0.04]"
          />
        </label>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">Matter type</span>
        <div className="flex flex-wrap gap-1.5">
          {MATTER_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...config, matterType: type })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                config.matterType === type
                  ? "border-stone-500/40 bg-stone-700 text-stone-50 dark:border-stone-400/30 dark:bg-stone-200 dark:text-stone-900"
                  : "border-black/[0.06] bg-white/70 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]",
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-medium text-muted-foreground">Starter cases</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {DEMO_SESSION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPreset(preset.id)}
              className={cn(
                "rounded-xl border p-3 text-left transition-all",
                config.presetId === preset.id
                  ? "border-stone-400/50 bg-stone-100/90 dark:border-white/20 dark:bg-white/[0.08]"
                  : "border-black/[0.05] bg-white/50 hover:border-stone-300/60 dark:border-white/[0.06] dark:bg-white/[0.03]",
              )}
            >
              <p className="text-[13px] font-semibold">{preset.label}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{preset.subtitle}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-[11px] text-amber-900/90 dark:text-amber-200/90">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p>
          Exhibits from presets are preloaded. You may attach local files — they are held in-browser for
          this simulation only.
        </p>
      </div>
    </section>
  );
}
