"use client";

import { ChevronDown, Lock } from "lucide-react";

import { PrepareCaseIntake } from "@/components/courtroom/prepare-case-intake";
import { AgentPersonaCard } from "@/components/courtroom/agent-persona-card";
import { DEMO_SESSION_PRESETS } from "@/lib/courtroom/demo-sessions";
import { intakeSummaryChips, hasMinimumIntake } from "@/lib/courtroom/case-bundle";
import type { AgentPersona, CaseIntakeBundle, CourtroomSessionConfig } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

const MATTER_TYPES = ["Commercial", "Constitutional", "Civil", "Criminal", "Arbitration"] as const;

interface PrepareCasePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: CourtroomSessionConfig;
  onChange: (config: CourtroomSessionConfig) => void;
  onSelectPreset: (presetId: string) => void;
  intakeBundle: CaseIntakeBundle;
  onIntakeChange: (bundle: CaseIntakeBundle) => void;
  pdfFiles: Map<string, File>;
  onPdfFile: (artifactId: string, file: File) => void;
  agents?: AgentPersona[];
  agentsLocked: boolean;
  disabled?: boolean;
}

export function PrepareCasePanel({
  open,
  onOpenChange,
  config,
  onChange,
  onSelectPreset,
  intakeBundle,
  onIntakeChange,
  pdfFiles,
  onPdfFile,
  agents,
  agentsLocked,
  disabled,
}: PrepareCasePanelProps) {
  const chips = intakeSummaryChips(intakeBundle);
  const intakeComplete = hasMinimumIntake(intakeBundle);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-black/[0.06] bg-white/60 backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "cs-card-in",
      )}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Prepare Case
          </p>
          <p className="mt-0.5 truncate text-[14px] font-semibold">
            {config.matterTitle || "Configure matter & intake"}
          </p>
          {!open && chips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-black/[0.06] bg-white/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-5 border-t border-black/[0.05] px-4 pb-5 pt-4 sm:px-5 dark:border-white/[0.06] cs-fold">
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
              <span className="text-[11px] font-medium text-muted-foreground">Quick presets</span>
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

            <PrepareCaseIntake
              bundle={intakeBundle}
              onChange={onIntakeChange}
              pdfFiles={pdfFiles}
              onPdfFile={onPdfFile}
              disabled={disabled}
            />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">Agent preview</span>
                {agentsLocked && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    Build agents to unlock
                  </span>
                )}
              </div>
              {agentsLocked || !agents?.length ? (
                <div className="rounded-xl border border-dashed border-black/[0.08] px-4 py-6 text-center text-[12px] text-muted-foreground dark:border-white/10">
                  {intakeComplete
                    ? "Ready to forge Judge and Advocate personas from your intake."
                    : "Add a brief or at least one artifact to enable agent forging."}
                </div>
              ) : (
                <div className="grid gap-2 lg:grid-cols-3">
                  {agents.map((agent) => (
                    <AgentPersonaCard key={agent.id} persona={agent} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
