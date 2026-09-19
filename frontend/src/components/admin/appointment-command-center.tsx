"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Eye, MessageSquare, ScrollText, Siren, UserCog } from "lucide-react";

import { ActivityLogTable } from "@/components/admin/activity-log-table";
import { AdminTranscriptPane } from "@/components/admin/admin-transcript-pane";
import { DurationControlSlider } from "@/components/admin/duration-control-slider";
import { PartyModerationCard } from "@/components/admin/party-moderation-card";
import { SessionDiagnostics } from "@/components/admin/session-diagnostics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  adminAckEmergency,
  adminAppointmentLogs,
  adminForceCancelAppointment,
  adminForceCompleteAppointment,
  adminForceSummon,
  adminGetAppointment,
  adminKickParticipant,
  adminListLawyers,
  adminReassignAppointment,
  adminResetCall,
  adminResolveEmergency,
  adminSessionHealth,
  adminSetDuration,
  adminSetPriority,
  adminSuspendParticipant,
  adminSystemMessage,
  adminAllowRejoinParticipant,
  getStoredUser,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type CommandTab = "overview" | "logs" | "transcript";
type MobilePanel = "controls" | CommandTab;

interface AppointmentCommandCenterProps {
  appointmentId: string;
}

export function AppointmentCommandCenter({ appointmentId }: AppointmentCommandCenterProps) {
  const searchParams = useSearchParams();
  const focusSos = searchParams.get("focus") === "sos";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const me = getStoredUser();
  const [tab, setTab] = useState<CommandTab>("overview");
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("overview");
  const [logsPage, setLogsPage] = useState(1);
  const [sysMsg, setSysMsg] = useState("");
  const [reason, setReason] = useState("");
  const [reassignId, setReassignId] = useState("");
  const [reassignReason, setReassignReason] = useState("");

  const detailQuery = useQuery({
    queryKey: ["admin-appointment", appointmentId],
    queryFn: () => adminGetAppointment(appointmentId),
    refetchInterval: (q) => {
      const apt = q.state.data?.appointment;
      return apt && (apt.status === "live" || apt.emergency_status === "open" || apt.emergency_status === "ack")
        ? 2000
        : false;
    },
  });

  const healthQuery = useQuery({
    queryKey: ["admin-session-health", appointmentId],
    queryFn: () => adminSessionHealth(appointmentId),
    refetchInterval: (q) => {
      const apt = detailQuery.data?.appointment;
      return apt && (apt.status === "live" || apt.join_state === "joinable") ? 3000 : false;
    },
  });

  const logsQuery = useQuery({
    queryKey: ["admin-appointment-logs", appointmentId, logsPage],
    queryFn: () => adminAppointmentLogs(appointmentId, { page: logsPage, size: 50 }),
    enabled: tab === "logs",
  });

  const lawyersQuery = useQuery({
    queryKey: ["admin-lawyers"],
    queryFn: adminListLawyers,
  });

  const apt = detailQuery.data?.appointment;
  const verifiedLawyers = useMemo(
    () => (lawyersQuery.data ?? []).filter((l) => l.is_verified || l.verified),
    [lawyersQuery.data],
  );

  useEffect(() => {
    if (apt) setReassignId(apt.lawyer_id);
  }, [apt?.lawyer_id, apt]);

  useEffect(() => {
    if (focusSos) setTab("overview");
  }, [focusSos]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin-appointment", appointmentId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-session-health", appointmentId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-appointment-logs", appointmentId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
  }

  const durationMut = useMutation({
    mutationFn: (scheduledEndAt: string) => adminSetDuration(appointmentId, { scheduled_end_at: scheduledEndAt }),
    onSuccess: () => {
      toast({ title: "Duration updated" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Duration update failed", description: err.message, variant: "destructive" }),
  });

  const reassignMut = useMutation({
    mutationFn: () => adminReassignAppointment(appointmentId, reassignId, reassignReason.trim() || undefined),
    onSuccess: () => {
      toast({ title: "Counsel reassigned" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Reassign failed", description: err.message, variant: "destructive" }),
  });

  const sysMut = useMutation({
    mutationFn: (body: string) => adminSystemMessage(appointmentId, body),
    onSuccess: () => {
      toast({ title: "System message sent" });
      setSysMsg("");
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Message failed", description: err.message, variant: "destructive" }),
  });

  const summonMut = useMutation({
    mutationFn: () => adminForceSummon(appointmentId),
    onSuccess: () => {
      toast({ title: "Summon sent" });
      invalidate();
    },
  });

  const ackMut = useMutation({
    mutationFn: () => adminAckEmergency(appointmentId),
    onSuccess: () => {
      toast({ title: "SOS acknowledged" });
      invalidate();
    },
  });

  const resolveMut = useMutation({
    mutationFn: () => adminResolveEmergency(appointmentId),
    onSuccess: () => {
      toast({ title: "SOS resolved" });
      invalidate();
    },
  });

  const kickMut = useMutation({
    mutationFn: (target: "citizen" | "lawyer") => adminKickParticipant(appointmentId, target, "Removed by operations"),
    onSuccess: () => {
      toast({ title: "Participant kicked" });
      invalidate();
    },
  });

  const suspendMut = useMutation({
    mutationFn: ({ target, minutes }: { target: "citizen" | "lawyer"; minutes: 5 | 15 | 30 }) =>
      adminSuspendParticipant(appointmentId, target, minutes, "Suspended by operations"),
    onSuccess: () => {
      toast({ title: "Participant suspended" });
      invalidate();
    },
  });

  const allowRejoinMut = useMutation({
    mutationFn: (target: "citizen" | "lawyer") => adminAllowRejoinParticipant(appointmentId, target),
    onSuccess: () => {
      toast({ title: "Participant may rejoin" });
      invalidate();
    },
  });

  const resetCallMut = useMutation({
    mutationFn: () => adminResetCall(appointmentId),
    onSuccess: () => {
      toast({ title: "Call reset" });
      invalidate();
    },
  });

  const priorityMut = useMutation({
    mutationFn: (priority: "normal" | "urgent" | "emergency") => adminSetPriority(appointmentId, priority),
    onSuccess: () => {
      toast({ title: "Priority updated" });
      invalidate();
    },
  });

  const cancelMut = useMutation({
    mutationFn: () => adminForceCancelAppointment(appointmentId, reason.trim()),
    onSuccess: () => {
      toast({ title: "Appointment cancelled" });
      setReason("");
      invalidate();
    },
  });

  const completeMut = useMutation({
    mutationFn: () => adminForceCompleteAppointment(appointmentId, reason.trim()),
    onSuccess: () => {
      toast({ title: "Appointment closed" });
      setReason("");
      invalidate();
    },
  });

  if (detailQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!apt) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="text-muted-foreground">Appointment not found.</p>
        <Button asChild className="mt-4 rounded-xl">
          <Link href="/admin/appointments">Back to ops</Link>
        </Button>
      </div>
    );
  }

  const assignedToMe = apt.assigned_admin_user_id === me?.user_id;
  const showSosPanel = apt.emergency_status === "open" || apt.emergency_status === "ack";

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-4 py-4 pb-8">
      <header className="sticky top-0 z-30 -mx-4 border-b border-black/[0.06] bg-background/95 px-4 py-3 backdrop-blur-md dark:border-white/10">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/appointments" className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Command center</p>
            <p className="truncate text-base font-semibold sm:text-lg">
              <span className="sm:hidden">{apt.citizen_name} ↔ {apt.lawyer_name}</span>
              <span className="hidden sm:inline">Citizen: {apt.citizen_name} · Counsel: {apt.lawyer_name}</span>
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Badge variant="secondary" className="capitalize">
              {apt.status.replace("_", " ")}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {apt.join_state}
            </Badge>
            {showSosPanel ? <Badge className="bg-amber-600 capitalize">{apt.emergency_status}</Badge> : null}
            {assignedToMe ? (
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-700">
                Assigned to you
              </Badge>
            ) : null}
            {(apt.status === "live" || apt.join_state === "joinable") && (
              <Button asChild size="sm" className="rounded-xl bg-emerald-700 hover:bg-emerald-800">
                <Link href={`/admin/appointments/${appointmentId}/observe`}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Observe
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="mt-3 flex shrink-0 gap-1 overflow-x-auto border-b border-black/[0.06] pb-2 lg:hidden dark:border-white/10">
        {(
          [
            ["controls", UserCog, "Controls"],
            ["overview", ScrollText, "Overview"],
            ["logs", Clock, "Logs"],
            ["transcript", MessageSquare, "Transcript"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMobilePanel(id);
              if (id !== "controls") setTab(id);
            }}
            className={cn(
              "flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-medium transition",
              mobilePanel === id ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <aside
          className={cn(
            "space-y-4 lg:max-h-[calc(100dvh-140px)] lg:overflow-y-auto lg:pr-1",
            mobilePanel !== "controls" && "hidden lg:block",
          )}
        >
          <SessionDiagnostics
            health={healthQuery.data}
            loading={healthQuery.isFetching}
            onRefresh={() => void healthQuery.refetch()}
            onDurationAdjust={() => document.getElementById("duration-control")?.scrollIntoView({ behavior: "smooth" })}
            onSummon={() => summonMut.mutate()}
            onResetCall={() => resetCallMut.mutate()}
            onManageSos={() => document.getElementById("sos-panel")?.scrollIntoView({ behavior: "smooth" })}
          />

          <div id="duration-control">
            <DurationControlSlider
              appointment={apt}
              disabled={durationMut.isPending}
              onApply={(scheduledEndAt) => durationMut.mutate(scheduledEndAt)}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <PartyModerationCard
              label="Citizen"
              present={Boolean(apt.citizen_present)}
              moderation={apt.citizen_moderation}
              disabled={kickMut.isPending || suspendMut.isPending || allowRejoinMut.isPending}
              onKick={() => kickMut.mutate("citizen")}
              onSuspend={(m) => suspendMut.mutate({ target: "citizen", minutes: m })}
              onAllowRejoin={() => allowRejoinMut.mutate("citizen")}
            />
            <PartyModerationCard
              label="Counsel"
              present={Boolean(apt.lawyer_present)}
              moderation={apt.lawyer_moderation}
              disabled={kickMut.isPending || suspendMut.isPending || allowRejoinMut.isPending}
              onKick={() => kickMut.mutate("lawyer")}
              onSuspend={(m) => suspendMut.mutate({ target: "lawyer", minutes: m })}
              onAllowRejoin={() => allowRejoinMut.mutate("lawyer")}
            />
          </div>

          <div className="rounded-2xl border border-black/[0.06] p-3 dark:border-white/10">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <UserCog className="h-3.5 w-3.5" />
              Quick actions
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="min-h-11 rounded-xl sm:min-h-9" disabled={summonMut.isPending} onClick={() => summonMut.mutate()}>
                Summon
              </Button>
              <Button size="sm" variant="outline" className="min-h-11 rounded-xl sm:min-h-9" disabled={resetCallMut.isPending} onClick={() => resetCallMut.mutate()}>
                Reset call
              </Button>
              {(["normal", "urgent", "emergency"] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={apt.priority === p ? "default" : "outline"}
                  className="min-h-11 rounded-xl capitalize sm:min-h-9"
                  disabled={priorityMut.isPending}
                  onClick={() => priorityMut.mutate(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        </aside>

        <section
          className={cn(
            "flex min-h-0 flex-1 flex-col rounded-2xl border border-black/[0.06] dark:border-white/10 lg:max-h-[calc(100dvh-140px)]",
            mobilePanel === "controls" && "hidden lg:flex",
          )}
        >
          <div className="hidden shrink-0 gap-1 border-b border-black/[0.06] p-2 dark:border-white/10 lg:flex">
            {(
              [
                ["overview", ScrollText, "Overview"],
                ["logs", Clock, "Logs"],
                ["transcript", MessageSquare, "Transcript"],
              ] as const
            ).map(([id, Icon, label]) => (
              <Button
                key={id}
                size="sm"
                variant={tab === id ? "default" : "ghost"}
                className="rounded-xl"
                onClick={() => {
                  setTab(id);
                  setMobilePanel(id);
                }}
              >
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {label}
              </Button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === "overview" && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed">{apt.matter_summary}</p>

                {showSosPanel && (
                  <div
                    id="sos-panel"
                    className={cn(
                      "rounded-2xl border border-amber-500/40 bg-amber-50/80 p-4 dark:bg-amber-950/30",
                      focusSos && "ring-2 ring-amber-500",
                    )}
                  >
                    <p className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100">
                      <Siren className="h-4 w-4" />
                      SOS — {apt.emergency_status}
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{apt.emergency_reason || "Help requested"}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {apt.emergency_status === "open" && (
                        <Button size="sm" className="rounded-xl" disabled={ackMut.isPending} onClick={() => ackMut.mutate()}>
                          Acknowledge SOS
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="rounded-xl" disabled={resolveMut.isPending} onClick={() => resolveMut.mutate()}>
                        Resolve SOS
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <select
                    value={reassignId}
                    onChange={(e) => setReassignId(e.target.value)}
                    className="h-9 w-full rounded-xl border border-black/[0.08] bg-background px-3 text-[13px] dark:border-white/10"
                  >
                    {verifiedLawyers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.full_name}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    placeholder="Reassign reason (optional)"
                    className="h-9 rounded-xl"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={reassignMut.isPending || !reassignId}
                    onClick={() => reassignMut.mutate()}
                  >
                    Reassign counsel
                  </Button>
                </div>

                <div className="space-y-2">
                  <Input
                    value={sysMsg}
                    onChange={(e) => setSysMsg(e.target.value)}
                    placeholder="System message to both parties"
                    className="h-9 rounded-xl"
                  />
                  <Button size="sm" className="rounded-xl" disabled={sysMut.isPending || !sysMsg.trim()} onClick={() => sysMut.mutate(sysMsg.trim())}>
                    Send system message
                  </Button>
                </div>

                <div className="space-y-2 border-t border-black/[0.06] pt-3 dark:border-white/10">
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason for force action (required)"
                    className="h-9 rounded-xl"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={cancelMut.isPending || reason.trim().length < 3}
                      onClick={() => cancelMut.mutate()}
                    >
                      Force cancel
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={completeMut.isPending || reason.trim().length < 3}
                      onClick={() => completeMut.mutate()}
                    >
                      Force complete
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {tab === "logs" && (
              <ActivityLogTable
                items={logsQuery.data?.items ?? []}
                total={logsQuery.data?.total ?? 0}
                page={logsPage}
                loading={logsQuery.isLoading}
                onPageChange={setLogsPage}
              />
            )}

            {tab === "transcript" && (
              <AdminTranscriptPane appointment={apt} messages={detailQuery.data?.messages ?? []} className="h-full min-h-[360px]" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
