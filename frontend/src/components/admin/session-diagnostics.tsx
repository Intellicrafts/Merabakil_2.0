"use client";

import { AlertTriangle, CircleSlash, MessageCircle, Phone, RefreshCw, Video, Wifi, WifiOff } from "lucide-react";

import { ISSUE_LABELS, PresenceDot } from "@/components/admin/admin-ops-utils";
import { Button } from "@/components/ui/button";
import type { PartyHealth, SessionHealth, SessionDiagnosticIssue } from "@/lib/appointment-types";
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

type ConnMode = "video" | "audio" | "livekit" | "text" | "disconnected" | "absent";

function getConnMode(
  party: PartyHealth,
  lk: SessionHealth["livekit"],
  call: SessionHealth["call"],
): ConnMode {
  if (!party.present) return "absent";
  if (lk.mode !== "livekit") return "text";
  if (!party.livekit_connected) return "disconnected";
  if (call?.active && call.mode === "video") return "video";
  if (call?.active && call.mode === "audio") return "audio";
  return "livekit";
}

const CONN_CONFIG: Record<ConnMode, { icon: React.ElementType; label: string; className: string }> = {
  video:        { icon: Video,         label: "Video call",   className: "text-emerald-700 dark:text-emerald-300" },
  audio:        { icon: Phone,         label: "Audio call",   className: "text-emerald-700 dark:text-emerald-300" },
  livekit:      { icon: Wifi,          label: "In room",      className: "text-blue-600 dark:text-blue-400" },
  text:         { icon: MessageCircle, label: "Chat only",    className: "text-slate-500 dark:text-slate-400" },
  disconnected: { icon: WifiOff,       label: "No video",     className: "text-amber-700 dark:text-amber-400" },
  absent:       { icon: CircleSlash,   label: "Not present",  className: "text-muted-foreground" },
};

function PartyStatusCard({
  name,
  party,
  lk,
  call,
}: {
  name: string;
  party: PartyHealth;
  lk: SessionHealth["livekit"];
  call: SessionHealth["call"];
}) {
  const mode = getConnMode(party, lk, call);
  const { icon: Icon, label, className } = CONN_CONFIG[mode];

  return (
    <div className="flex flex-1 flex-col gap-2 rounded-xl border border-black/[0.06] bg-background/60 px-3 py-2.5 dark:border-white/10">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{name}</p>
      <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <PresenceDot on={party.present} />
        {party.present ? "Present" : "Away"}
      </span>
      <span className={cn("flex items-center gap-1.5 text-[12px] font-medium", className)}>
        <Icon className="h-3.5 w-3.5 shrink-0" />
        {label}
      </span>
    </div>
  );
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

      <div className="mt-2 flex gap-2">
        <PartyStatusCard name="Citizen" party={health.citizen} lk={health.livekit} call={health.call} />
        <PartyStatusCard name="Counsel" party={health.lawyer} lk={health.livekit} call={health.call} />
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        {health.livekit.participant_count} in LiveKit room · {health.livekit.mode} mode
      </p>

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
