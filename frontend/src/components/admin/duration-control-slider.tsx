"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";

import { formatClock } from "@/components/admin/admin-ops-utils";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import type { AppointmentRecord } from "@/lib/appointment-types";

interface DurationControlSliderProps {
  appointment: AppointmentRecord;
  disabled?: boolean;
  onApply: (scheduledEndAt: string) => void;
}

export function DurationControlSlider({ appointment, disabled, onApply }: DurationControlSliderProps) {
  const baseEnd = useMemo(
    () => (appointment.scheduled_end_at ? new Date(appointment.scheduled_end_at).getTime() : Date.now()),
    [appointment.scheduled_end_at],
  );
  const [delta, setDelta] = useState(0);

  useEffect(() => {
    setDelta(0);
  }, [appointment.id, appointment.scheduled_end_at]);

  const previewEnd = new Date(baseEnd + delta * 60_000);
  const remainingMins = Math.max(0, Math.round((previewEnd.getTime() - Date.now()) / 60_000));
  const isLive = appointment.status === "live";
  const minLiveEnd = Date.now() + 60_000;
  const applyDisabled =
    disabled || delta === 0 || (isLive && previewEnd.getTime() < minLiveEnd);

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-gradient-to-br from-slate-50/80 to-white/60 p-4 dark:border-white/10 dark:from-slate-950/30 dark:to-white/[0.02]">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Session duration
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <p>
          <span className="text-muted-foreground">Start</span>
          <br />
          <span className="font-medium">{formatClock(appointment.scheduled_at)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">End (preview)</span>
          <br />
          <span className="font-medium">{formatClock(previewEnd.toISOString())}</span>
        </p>
      </div>
      <p className="mt-2 text-[11px] text-emerald-700 dark:text-emerald-300">{remainingMins} min remaining after apply</p>
      {isLive && previewEnd.getTime() < minLiveEnd ? (
        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
          Live sessions must keep at least 1 minute remaining.
        </p>
      ) : null}
      <div className="mt-4 space-y-2">
        <Slider min={-60} max={60} step={5} value={delta} onValueChange={setDelta} disabled={disabled} />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>−60 min</span>
          <span className="font-medium text-foreground">{delta >= 0 ? `+${delta}` : delta} min</span>
          <span>+60 min</span>
        </div>
      </div>
      <Button
        size="sm"
        className="mt-3 w-full rounded-xl"
        disabled={applyDisabled}
        onClick={() => {
          if (delta === 0) return;
          if (delta < 0 && isLive) {
            const ok = window.confirm("Shortening a live session may end the consultation window. Continue?");
            if (!ok) return;
          }
          onApply(previewEnd.toISOString());
        }}
      >
        Apply duration change
      </Button>
    </div>
  );
}
