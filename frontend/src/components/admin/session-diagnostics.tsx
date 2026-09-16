"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { ISSUE_LABELS } from "@/components/admin/admin-ops-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SessionHealth, SessionDiagnosticIssue } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

interface SessionDiagnosticsProps {
  health: SessionHealth | undefined;
  loading?: boolean;
  onRefresh?: () => void;
  onDurationAdjust?: () => void;
  onSummon?: () => void;
  onResetCall?: () => void;
  onManageSos?: () => void;
}

function issueAction(
  issue: SessionDiagnosticIssue,
  handlers: Pick<SessionDiagnosticsProps, "onDurationAdjust" | "onSummon" | "onResetCall" | "onManageSos">,
): { label: string; onClick?: () => void } | null {
  switch (issue) {
    case "lawyer_not_present":
    case "citizen_not_present":
      return { label: "Force summon", onClick: handlers.onSummon };
    case "window_expiring":
      return { label: "Adjust duration", onClick: handlers.onDurationAdjust };
    case "call_stuck_ringing":
      return { label: "Reset call", onClick: handlers.onResetCall };
    case "active_emergency":
      return { label: "Manage SOS", onClick: handlers.onManageSos };
    default:
      return null;
  }
}

export function SessionDiagnostics({
  health,
  loading,
  onRefresh,
  onDurationAdjust,
  onSummon,
  onResetCall,
  onManageSos,
}: SessionDiagnosticsProps) {
  if (!health && loading) {
    return <p className="text-[12px] text-muted-foreground">Loading diagnostics…</p>;
  }
  if (!health) return null;

  const issues = health.diagnostics.issues;
  const handlers = { onDurationAdjust, onSummon, onResetCall, onManageSos };

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-muted/20 p-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5" />
          Session diagnostics
        </p>
        {onRefresh ? (
          <Button size="sm" variant="ghost" className="h-7 rounded-lg px-2" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Badge variant="outline" className="rounded-lg text-[10px]">
          LiveKit · {health.livekit.mode}
        </Badge>
        <Badge variant="outline" className="rounded-lg text-[10px]">
          {health.livekit.participant_count} in room
        </Badge>
      </div>

      {issues.length === 0 ? (
        <p className="mt-2 text-[12px] text-emerald-700 dark:text-emerald-300">All checks passed — session healthy.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {issues.map((issue) => {
            const action = issueAction(issue, handlers);
            return (
              <li
                key={issue}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/80 px-2.5 py-1.5 text-[12px]"
              >
                <span>{ISSUE_LABELS[issue] ?? issue.replaceAll("_", " ")}</span>
                {action?.onClick ? (
                  <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px]" onClick={action.onClick}>
                    {action.label}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
