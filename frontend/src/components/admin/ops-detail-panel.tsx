"use client";

import Link from "next/link";
import { Siren } from "lucide-react";

import { AttachmentPreview } from "@/components/appointment-room/attachment-preview";
import { formatClock, PresenceDot } from "@/components/admin/admin-ops-utils";
import { PartyModerationCard } from "@/components/admin/party-moderation-card";
import { SessionDiagnostics } from "@/components/admin/session-diagnostics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppointmentMessage, AppointmentRecord, SessionHealth } from "@/lib/appointment-types";
import { getStoredUser } from "@/lib/api";

interface OpsDetailPanelProps {
  selectedId: string | null;
  selected: AppointmentRecord | undefined;
  loading?: boolean;
  messages: AppointmentMessage[];
  events: { id: string; type: string; created_at: string | null }[];
  health?: SessionHealth;
  healthLoading?: boolean;
  sysMsg: string;
  reason: string;
  reassignId: string;
  lawyers: { id: string; full_name: string; is_verified?: boolean; verified?: boolean }[];
  pending?: {
    extend?: boolean;
    summon?: boolean;
    reassign?: boolean;
    sys?: boolean;
    cancel?: boolean;
    complete?: boolean;
    priority?: boolean;
    moderation?: boolean;
  };
  onSysMsgChange: (v: string) => void;
  onReasonChange: (v: string) => void;
  onReassignIdChange: (v: string) => void;
  onDurationAdjust?: () => void;
  onSummon: () => void;
  onReassign: () => void;
  onSystemMessage: () => void;
  onForceCancel: () => void;
  onForceComplete: () => void;
  onPriority: (p: "normal" | "urgent" | "emergency") => void;
  onManageSos: () => void;
  onRefreshHealth?: () => void;
  onResetCall?: () => void;
  onKick: (target: "citizen" | "lawyer") => void;
  onAllowRejoin: (target: "citizen" | "lawyer") => void;
}

export function OpsDetailPanel({
  selectedId,
  selected,
  loading,
  messages,
  events,
  health,
  healthLoading,
  sysMsg,
  reason,
  reassignId,
  lawyers,
  pending = {},
  onSysMsgChange,
  onReasonChange,
  onReassignIdChange,
  onDurationAdjust,
  onSummon,
  onReassign,
  onSystemMessage,
  onForceCancel,
  onForceComplete,
  onPriority,
  onManageSos,
  onRefreshHealth,
  onResetCall,
  onKick,
  onAllowRejoin,
}: OpsDetailPanelProps) {
  const me = getStoredUser();
  const assignedToMe = selected?.assigned_admin_user_id === me?.user_id;

  return (
    <Card className="min-h-[420px]">
      <CardHeader>
        <CardTitle className="text-base">Ops detail</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selectedId && <p className="text-sm text-muted-foreground">Select an appointment from the queue.</p>}
        {loading && selectedId && <Skeleton className="h-32 w-full rounded-2xl" />}
        {selected && (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="capitalize">
                {selected.status.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {selected.join_state}
              </Badge>
              {selected.emergency_status !== "none" ? (
                <Badge className="bg-amber-600 capitalize">{selected.emergency_status}</Badge>
              ) : null}
              {selected.assigned_admin_user_id ? (
                <Badge variant="outline" className={assignedToMe ? "border-emerald-500/50 text-emerald-700" : ""}>
                  {assignedToMe ? "Assigned to you" : "Admin assigned"}
                </Badge>
              ) : (
                <Badge variant="outline">Unassigned</Badge>
              )}
            </div>

            {selected.ops_note ? (
              <div className="rounded-xl border border-slate-500/20 bg-slate-50/60 px-3 py-2 text-[12px] dark:bg-slate-950/20">
                <p className="font-semibold">Ops note</p>
                <p className="mt-0.5">{selected.ops_note}</p>
              </div>
            ) : null}

            <p className="text-sm leading-relaxed">{selected.matter_summary}</p>

            <SessionDiagnostics
              health={health}
              loading={healthLoading}
              onRefresh={onRefreshHealth}
              onDurationAdjust={onDurationAdjust}
              onSummon={onSummon}
              onResetCall={onResetCall}
              onManageSos={onManageSos}
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <PartyModerationCard
                label="Citizen"
                present={Boolean(selected.citizen_present)}
                moderation={selected.citizen_moderation}
                disabled={pending.moderation}
                onKick={() => onKick("citizen")}
                onAllowRejoin={() => onAllowRejoin("citizen")}
              />
              <PartyModerationCard
                label="Counsel"
                present={Boolean(selected.lawyer_present)}
                moderation={selected.lawyer_moderation}
                disabled={pending.moderation}
                onKick={() => onKick("lawyer")}
                onAllowRejoin={() => onAllowRejoin("lawyer")}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
              <p>Start: {formatClock(selected.scheduled_at)}</p>
              <p>End: {formatClock(selected.scheduled_end_at)}</p>
            </div>

            {selected.emergency_reason ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-50/60 px-3 py-2 text-[12px] dark:bg-amber-950/20">
                <p className="font-semibold">Emergency reason</p>
                <p className="mt-0.5">{selected.emergency_reason}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {(selected.status === "live" || selected.join_state === "joinable") && (
                <Link
                  href={`/admin/appointments/${selected.id}/observe`}
                  className="inline-flex h-8 items-center rounded-xl bg-emerald-700 px-3 text-[12px] font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600"
                >
                  Observe room
                </Link>
              )}
              {(selected.emergency_status === "open" || selected.emergency_status === "ack") && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-amber-500/40 text-amber-900 dark:text-amber-100"
                  onClick={onManageSos}
                >
                  <Siren className="mr-1 h-3.5 w-3.5" />
                  Manage SOS
                </Button>
              )}
              <Button size="sm" variant="outline" className="rounded-xl" disabled={pending.summon} onClick={onSummon}>
                Force summon
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["normal", "urgent", "emergency"] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={selected.priority === p ? "default" : "outline"}
                  className="rounded-xl capitalize"
                  disabled={pending.priority}
                  onClick={() => onPriority(p)}
                >
                  {p}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <select
                value={reassignId}
                onChange={(e) => onReassignIdChange(e.target.value)}
                className="h-9 w-full rounded-xl border border-black/[0.08] bg-background px-3 text-[13px] dark:border-white/10"
              >
                {lawyers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.full_name}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="outline" className="rounded-xl" disabled={pending.reassign || !reassignId} onClick={onReassign}>
                Reassign counsel
              </Button>
            </div>

            <div className="space-y-2">
              <Input
                value={sysMsg}
                onChange={(e) => onSysMsgChange(e.target.value)}
                placeholder="System message to both parties"
                className="h-9 rounded-xl"
              />
              <Button size="sm" className="rounded-xl" disabled={pending.sys || !sysMsg.trim()} onClick={onSystemMessage}>
                Send system message
              </Button>
            </div>

            <div className="space-y-2 border-t border-black/[0.06] pt-3 dark:border-white/10">
              <Input
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="Reason for force action (required)"
                className="h-9 rounded-xl"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  disabled={pending.cancel || reason.trim().length < 3}
                  onClick={onForceCancel}
                >
                  Force cancel
                </Button>
                <Button
                  size="sm"
                  className="rounded-xl"
                  disabled={pending.complete || reason.trim().length < 3}
                  onClick={onForceComplete}
                >
                  Force complete
                </Button>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Timeline</p>
              <ol className="no-scrollbar mt-2 max-h-28 space-y-1 overflow-y-auto">
                {events.map((event) => (
                  <li key={event.id} className="text-[11px] text-muted-foreground">
                    <span className="font-medium capitalize text-foreground">{event.type.replaceAll("_", " ")}</span>
                    {event.created_at ? ` · ${formatClock(event.created_at)}` : ""}
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live transcript</p>
              {messages.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                <ol className="no-scrollbar mt-2 max-h-48 space-y-2 overflow-y-auto">
                  {messages.map((msg) => (
                    <li key={msg.id} className="rounded-lg bg-muted/30 px-2 py-1.5 text-[12px]">
                      <span className="text-[10px] capitalize text-muted-foreground">{msg.sender_role}</span>
                      {msg.attachment ? (
                        <AttachmentPreview appointmentId={selected.id} attachment={msg.attachment} mine={false} />
                      ) : null}
                      {msg.body ? (
                        <p className={msg.sender_role === "admin" ? "mt-0.5 font-medium" : "mt-0.5"}>{msg.body}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
