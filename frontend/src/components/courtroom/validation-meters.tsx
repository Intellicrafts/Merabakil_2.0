"use client";

import { ConfidenceMeter } from "@/components/confidence-meter";
import type { HearingMetrics } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface ValidationMetersProps {
  metrics: HearingMetrics;
}

export function ValidationMeters({ metrics }: ValidationMetersProps) {
  return (
    <section
      className={cn(
        "space-y-3 rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "cs-card-in",
      )}
    >
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Validation meters
      </h2>
      <ConfidenceMeter label="Argument strength" value={metrics.argumentStrength} />
      <ConfidenceMeter label="Evidence support" value={metrics.evidenceSupport} />
      <ConfidenceMeter label="Procedural compliance" value={metrics.proceduralCompliance} />
    </section>
  );
}
