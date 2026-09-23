"use client";

import { Radio } from "lucide-react";

import { formatCountdown, healthRingClass, PresenceDot } from "@/components/admin/admin-ops-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppointmentRecord, SessionHealth } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";

interface LiveSessionMatrixProps {
  sessions: AppointmentRecord[];
  liveTotal: number;
  loading?: boolean;
  liveFilter: boolean;
  healthMap?: Record<string, SessionHealth>;
  onToggleLiveFilter: () => void;
  onSelect: (id: string) => void;
}

export function LiveSessionMatrix({
  sessions,
  liveTotal,
  loading,
  liveFilter,
  healthMap,
  onToggleLiveFilter,
  onSelect,
}: LiveSessionMatrixProps) {
  return (
    <Card className="border-emerald-500/25 bg-gradient-to-br from-emerald-50/80 to-white/60 dark:from-emerald-950/20 dark:to-white/[0.02]">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Radio className={cn("h-4 w-4", liveTotal > 0 && "animate-pulse text-emerald-600")} />
          Live now
          <Badge variant="secondary" className="ml-1 tabular-nums">
            {liveTotal}
          </Badge>
        </CardTitle>
        <Button size="sm" variant={liveFilter ? "default" : "outline"} className="rounded-xl" onClick={onToggleLiveFilter}>
          {liveFilter ? "Show all" : "Live only"}
        </Button>
      </CardHeader>
      <CardContent>
        {loading && sessions.length === 0 ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active consultation rooms. Sessions appear when a party joins during the window.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sessions.map((row) => {
              const issues = healthMap?.[row.id]?.diagnostics.issues ?? [];
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onSelect(row.id)}
                  className={cn(
                    "rounded-2xl border border-black/[0.06] bg-white/80 p-4 text-left transition hover:border-emerald-500/40 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04]",
                    "ring-2 ring-offset-2 ring-offset-background",
                    healthRingClass(issues),
                    row.emergency_status === "open" && "border-amber-500/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p {...CLARITY_MASK} className="truncate font-semibold">{row.citizen_name}</p>
                      <p {...CLARITY_MASK} className="truncate text-[12px] text-muted-foreground">{row.lawyer_name}</p>
                    </div>
                    <Badge className="shrink-0 capitalize" variant={row.status === "live" ? "default" : "secondary"}>
                      {row.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Citizen</span>
                      <span className="inline-flex items-center gap-1 font-medium">
                        <PresenceDot on={Boolean(row.citizen_present)} />
                        {row.citizen_present ? "In" : "Away"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Counsel</span>
                      <span className="inline-flex items-center gap-1 font-medium">
                        <PresenceDot on={Boolean(row.lawyer_present)} />
                        {row.lawyer_present ? "In" : "Away"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] tabular-nums text-emerald-800 dark:text-emerald-200">
                    {formatCountdown(row.seconds_until_end)} left
                    {row.emergency_status !== "none" && row.emergency_status !== "resolved"
                      ? ` · SOS ${row.emergency_status}`
                      : ""}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
