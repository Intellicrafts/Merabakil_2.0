"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Circle, Radio, Scale, Siren } from "lucide-react";

import { AttachmentPreview } from "@/components/appointment-room/attachment-preview";
import { RoomAlertBanner } from "@/components/appointment-room/room-alert-banner";
import { useAdminOpsEvents } from "@/hooks/use-admin-ops-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  adminAckEmergency,
  adminExtendAppointment,
  adminForceCancelAppointment,
  adminForceCompleteAppointment,
  adminForceSummon,
  adminGetAppointment,
  adminListAppointments,
  adminListLawyers,
  adminReassignAppointment,
  adminResolveEmergency,
  adminSetLawyerVerified,
  adminSetPriority,
  adminSystemMessage,
} from "@/lib/api";
import type { AdminOpsEvent, AppointmentRecord } from "@/lib/appointment-types";
import { playAlertChime, requestNotificationPermission, showBrowserNotification } from "@/lib/room-alerts";
import { cn } from "@/lib/utils";

const STATUSES = ["", "requested", "confirmed", "live", "completed", "expired", "cancelled", "no_show"];

function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PresenceDot({ on }: { on: boolean }) {
  return (
    <Circle
      className={cn("h-2 w-2 fill-current", on ? "text-emerald-500" : "text-muted-foreground/40")}
      aria-label={on ? "Present" : "Away"}
    />
  );
}

export default function AdminAppointmentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [liveFilter, setLiveFilter] = useState(false);
  const [emergencyFilter, setEmergencyFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sysMsg, setSysMsg] = useState("");
  const [reason, setReason] = useState("");
  const [reassignId, setReassignId] = useState("");
  const [flashEmergencyId, setFlashEmergencyId] = useState<string | null>(null);
  const [liveEmergencies, setLiveEmergencies] = useState<Record<string, AppointmentRecord>>({});
  const lastEmergencyFlash = useRef<string | null>(null);
  const refreshTimer = useRef<number | null>(null);

  const refreshQueue = useCallback(
    (immediate = false) => {
      const run = () => {
        void queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
        void queryClient.invalidateQueries({ queryKey: ["admin-appointment"] });
      };
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      if (immediate) {
        run();
        return;
      }
      refreshTimer.current = window.setTimeout(run, 700);
    },
    [queryClient],
  );

  useEffect(() => {
    requestNotificationPermission();
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    };
  }, []);

  const listQuery = useQuery({
    queryKey: ["admin-appointments", status, search, emergencyFilter, liveFilter],
    queryFn: () =>
      adminListAppointments({
        status: status || undefined,
        search: search || undefined,
        emergency: emergencyFilter || undefined,
        live: liveFilter || undefined,
      }),
    refetchInterval: (q) => {
      const liveTotal = q.state.data?.live_total ?? 0;
      return liveTotal > 0 ? 3000 : 8000;
    },
  });

  const detailQuery = useQuery({
    queryKey: ["admin-appointment", selectedId],
    queryFn: () => adminGetAppointment(selectedId!),
    enabled: Boolean(selectedId),
    refetchInterval: (q) => {
      const apt = q.state.data?.appointment;
      return apt && (apt.status === "live" || apt.emergency_status === "open" || apt.emergency_status === "ack")
        ? 2000
        : false;
    },
  });

  const lawyersQuery = useQuery({
    queryKey: ["admin-lawyers"],
    queryFn: adminListLawyers,
  });

  const onOpsEvent = useCallback(
    (event: AdminOpsEvent) => {
      if (event.type === "emergency" && event.appointment_id) {
        const payload = event.payload as AppointmentRecord;
        const aptId = event.appointment_id;

        if (payload.emergency_status === "open") {
          setLiveEmergencies((prev) => ({ ...prev, [aptId]: { ...payload, id: aptId } }));
          void playAlertChime("emergency");
          showBrowserNotification(
            "SOS request",
            `${payload.citizen_name || "Citizen"} · ${payload.lawyer_name || "Counsel"}: ${payload.emergency_reason || "Help requested"}`,
          );
          setFlashEmergencyId(aptId);
          window.setTimeout(() => setFlashEmergencyId(null), 6000);
          setSelectedId((prev) => prev ?? aptId);
          if (lastEmergencyFlash.current !== aptId) {
            lastEmergencyFlash.current = aptId;
            toast({
              title: "SOS request — action needed",
              description: payload.emergency_reason || "A party requested platform help.",
              variant: "destructive",
            });
          }
        } else {
          setLiveEmergencies((prev) => {
            const next = { ...prev };
            delete next[aptId];
            return next;
          });
        }
        refreshQueue(true);
        return;
      }

      if (event.type === "ops_update" || event.type === "message") {
        refreshQueue(event.type === "ops_update");
      }
    },
    [refreshQueue, toast],
  );

  const { connected: opsLive } = useAdminOpsEvents(onOpsEvent);

  const counts = listQuery.data?.counts ?? {};
  const emergencyCounts = listQuery.data?.emergency_counts ?? {};
  const liveSessions = listQuery.data?.live_matrix ?? [];
  const liveTotal = listQuery.data?.live_total ?? liveSessions.length;
  const openEmergencies = useMemo(() => {
    const map = new Map<string, AppointmentRecord>();
    for (const row of listQuery.data?.items ?? []) {
      if (row.emergency_status === "open") map.set(row.id, row);
    }
    for (const [id, row] of Object.entries(liveEmergencies)) {
      if (row.emergency_status === "open") {
        map.set(id, { ...map.get(id), ...row, id });
      }
    }
    return Array.from(map.values());
  }, [listQuery.data?.items, liveEmergencies]);

  const highlightedSos = openEmergencies.find((row) => row.id === flashEmergencyId) ?? openEmergencies[0] ?? null;

  const kpis = useMemo(
    () => [
      ["Upcoming", (counts.requested ?? 0) + (counts.confirmed ?? 0)],
      ["Live now", liveTotal],
      ["Emergencies", (emergencyCounts.open ?? 0) + (emergencyCounts.ack ?? 0)],
      ["Expired", counts.expired ?? 0],
    ],
    [counts, emergencyCounts, liveTotal],
  );

  const selected = detailQuery.data?.appointment;
  const verifiedLawyers = useMemo(
    () => (lawyersQuery.data ?? []).filter((l) => l.is_verified || l.verified),
    [lawyersQuery.data],
  );

  useEffect(() => {
    if (selected) setReassignId(selected.lawyer_id);
  }, [selected?.lawyer_id, selected]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-appointment"] });
  }

  const ackMut = useMutation({
    mutationFn: adminAckEmergency,
    onSuccess: () => {
      toast({ title: "Emergency acknowledged" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Ack failed", description: err.message, variant: "destructive" }),
  });

  const resolveMut = useMutation({
    mutationFn: adminResolveEmergency,
    onSuccess: () => {
      toast({ title: "Emergency resolved" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Resolve failed", description: err.message, variant: "destructive" }),
  });

  const extendMut = useMutation({
    mutationFn: ({ id, minutes }: { id: string; minutes: number }) => adminExtendAppointment(id, minutes),
    onSuccess: () => {
      toast({ title: "Window extended" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Extend failed", description: err.message, variant: "destructive" }),
  });

  const reassignMut = useMutation({
    mutationFn: ({ id, lawyerId }: { id: string; lawyerId: string }) => adminReassignAppointment(id, lawyerId),
    onSuccess: () => {
      toast({ title: "Counsel reassigned" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Reassign failed", description: err.message, variant: "destructive" }),
  });

  const sysMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => adminSystemMessage(id, body),
    onSuccess: () => {
      toast({ title: "System message sent" });
      setSysMsg("");
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Message failed", description: err.message, variant: "destructive" }),
  });

  const summonMut = useMutation({
    mutationFn: adminForceSummon,
    onSuccess: () => {
      toast({ title: "Summon sent" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Summon failed", description: err.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason: r }: { id: string; reason: string }) => adminForceCancelAppointment(id, r),
    onSuccess: () => {
      toast({ title: "Appointment cancelled" });
      setReason("");
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Cancel failed", description: err.message, variant: "destructive" }),
  });

  const completeMut = useMutation({
    mutationFn: ({ id, reason: r }: { id: string; reason: string }) => adminForceCompleteAppointment(id, r),
    onSuccess: () => {
      toast({ title: "Appointment closed" });
      setReason("");
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Close failed", description: err.message, variant: "destructive" }),
  });

  const verifyMut = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) => adminSetLawyerVerified(id, verified),
    onSuccess: () => {
      toast({ title: "Listing updated", variant: "success" });
      void queryClient.invalidateQueries({ queryKey: ["admin-lawyers"] });
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const priorityMut = useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: "normal" | "urgent" | "emergency" }) =>
      adminSetPriority(id, priority),
    onSuccess: () => {
      toast({ title: "Priority updated" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Priority failed", description: err.message, variant: "destructive" }),
  });

  function rowClass(row: AppointmentRecord) {
    if (row.emergency_status === "open") return "border-l-2 border-l-amber-500";
    if (row.emergency_status === "ack") return "border-l-2 border-l-orange-400";
    return "";
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CalendarClock className="h-6 w-6 text-primary" />
            Appointment operations
          </h1>
          <p className="text-sm text-muted-foreground">
            Live queue, emergency response, and counsel verification {opsLive ? "· Ops stream live" : "· Reconnecting…"}
          </p>
        </div>
      </div>

      {highlightedSos ? (
        <RoomAlertBanner
          kind="emergency"
          title="Live SOS request"
          body={`${highlightedSos.citizen_name} ↔ ${highlightedSos.lawyer_name}: ${highlightedSos.emergency_reason || "Help requested in the appointment room."}`}
          actionLabel="Open & manage"
          onAction={() => setSelectedId(highlightedSos.id)}
        />
      ) : null}

      {openEmergencies.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-50/80 p-3 dark:bg-amber-950/20">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-amber-950 dark:text-amber-100">
            <Siren className="h-4 w-4" />
            {openEmergencies.length} open emergency request{openEmergencies.length === 1 ? "" : "s"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {openEmergencies.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={cn(
                  "rounded-xl bg-white/80 px-3 py-1.5 text-left text-[12px] shadow-sm hover:bg-white dark:bg-white/10",
                  flashEmergencyId === row.id && "ring-2 ring-amber-500",
                )}
              >
                <span className="font-medium">{row.citizen_name}</span>
                <span className="text-muted-foreground"> · {row.lawyer_name}</span>
                {row.emergency_reason ? (
                  <span className="mt-0.5 block text-[11px] text-amber-900/80 dark:text-amber-100/80">{row.emergency_reason}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Card className="border-emerald-500/25 bg-gradient-to-br from-emerald-50/80 to-white/60 dark:from-emerald-950/20 dark:to-white/[0.02]">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className={cn("h-4 w-4", liveTotal > 0 && "text-emerald-600 animate-pulse")} />
            Live matrix
            <Badge variant="secondary" className="ml-1 tabular-nums">
              {liveTotal}
            </Badge>
          </CardTitle>
          <Button
            size="sm"
            variant={liveFilter ? "default" : "outline"}
            className="rounded-xl"
            onClick={() => setLiveFilter((v) => !v)}
          >
            {liveFilter ? "Show all" : "Live only"}
          </Button>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading && !listQuery.data ? (
            <Skeleton className="h-24 w-full" />
          ) : liveSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active consultation rooms. Sessions appear here when a citizen or counsel joins during the window.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {liveSessions.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    "rounded-2xl border border-black/[0.06] bg-white/80 p-4 text-left transition hover:border-emerald-500/40 hover:shadow-md dark:border-white/10 dark:bg-white/[0.04]",
                    selectedId === row.id && "ring-2 ring-emerald-500/50",
                    row.emergency_status === "open" && "border-amber-500/50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.citizen_name}</p>
                      <p className="truncate text-[12px] text-muted-foreground">{row.lawyer_name}</p>
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
                        {row.citizen_present ? "In room" : "Away"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">Counsel</span>
                      <span className="inline-flex items-center gap-1 font-medium">
                        <PresenceDot on={Boolean(row.lawyer_present)} />
                        {row.lawyer_present ? "In room" : "Away"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] tabular-nums text-emerald-800 dark:text-emerald-200">
                    Window · {formatCountdown(row.seconds_until_end)} left
                    {row.emergency_status !== "none" && row.emergency_status !== "resolved"
                      ? ` · SOS ${row.emergency_status}`
                      : ""}
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card className="min-h-[420px]">
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Queue {listQuery.data ? `(${listQuery.data.total})` : ""}</CardTitle>
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 rounded-xl border border-black/[0.08] bg-background px-3 text-[13px] dark:border-white/10"
              >
                {STATUSES.map((s) => (
                  <option key={s || "all"} value={s}>
                    {s ? s.replace("_", " ") : "All statuses"}
                  </option>
                ))}
              </select>
              <select
                value={emergencyFilter}
                onChange={(e) => setEmergencyFilter(e.target.value)}
                className="h-9 rounded-xl border border-black/[0.08] bg-background px-3 text-[13px] dark:border-white/10"
              >
                <option value="">All emergencies</option>
                <option value="open">Open only</option>
                <option value="ack">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or matter"
                className="h-9 w-full rounded-xl sm:w-48"
              />
            </div>
          </CardHeader>
          <CardContent>
            {listQuery.isError && (
              <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {(listQuery.error as Error).message || "Could not load appointments. Check marketplace service on :8010."}
              </div>
            )}
            {listQuery.isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            )}
            {listQuery.data && listQuery.data.items.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {liveFilter ? "No live sessions match this filter." : "No appointments in the queue yet."}
              </p>
            )}
            {listQuery.data && listQuery.data.items.length > 0 && (
              <div className="max-h-[520px] overflow-x-auto overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parties</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Presence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listQuery.data.items.map((row) => (
                      <TableRow
                        key={row.id}
                        className={cn("cursor-pointer", selectedId === row.id && "bg-muted/50", rowClass(row))}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <TableCell className="min-w-[160px]">
                          <p className="font-medium">{row.citizen_name}</p>
                          <p className="text-xs text-muted-foreground">{row.lawyer_name}</p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.date} · {row.time_slot}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {row.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize text-xs">
                          {row.emergency_status !== "none" && row.emergency_status !== "resolved" ? (
                            <span className="font-semibold text-amber-700 dark:text-amber-300">{row.emergency_status}</span>
                          ) : (
                            row.priority ?? "normal"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <PresenceDot on={Boolean(row.citizen_present)} /> C
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <PresenceDot on={Boolean(row.lawyer_present)} /> L
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[420px]">
          <CardHeader>
            <CardTitle className="text-base">Ops detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedId && <p className="text-sm text-muted-foreground">Select an appointment from the queue.</p>}
            {detailQuery.isLoading && selectedId && <Skeleton className="h-32 w-full" />}
            {selected && detailQuery.data && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="capitalize">{selected.status.replace("_", " ")}</Badge>
                  <Badge variant="outline" className="capitalize">{selected.join_state}</Badge>
                  {selected.emergency_status !== "none" ? (
                    <Badge className="bg-amber-600 capitalize">{selected.emergency_status}</Badge>
                  ) : null}
                </div>
                <p className="text-sm leading-relaxed">{selected.matter_summary}</p>
                <div className="grid grid-cols-2 gap-2 text-[12px] text-muted-foreground">
                  <p>Start: {formatClock(selected.scheduled_at)}</p>
                  <p>End: {formatClock(selected.scheduled_end_at)}</p>
                  <p className="inline-flex items-center gap-1">
                    Citizen <PresenceDot on={Boolean(selected.citizen_present)} />
                  </p>
                  <p className="inline-flex items-center gap-1">
                    Counsel <PresenceDot on={Boolean(selected.lawyer_present)} />
                  </p>
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
                      href={`/appointments/${selected.id}/room`}
                      className="inline-flex h-8 items-center rounded-xl bg-emerald-700 px-3 text-[12px] font-semibold text-white hover:bg-emerald-800 dark:bg-emerald-600"
                    >
                      Observe room
                    </Link>
                  )}
                  {(selected.emergency_status === "open" || selected.emergency_status === "ack") && (
                    <>
                      {selected.emergency_status === "open" && (
                        <Button size="sm" className="rounded-xl" disabled={ackMut.isPending} onClick={() => ackMut.mutate(selected.id)}>
                          Ack emergency
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="rounded-xl" disabled={resolveMut.isPending} onClick={() => resolveMut.mutate(selected.id)}>
                        Resolve
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => extendMut.mutate({ id: selected.id, minutes: 5 })}>
                    +5 min
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => extendMut.mutate({ id: selected.id, minutes: 10 })}>
                    +10 min
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-xl" disabled={summonMut.isPending} onClick={() => summonMut.mutate(selected.id)}>
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
                      disabled={priorityMut.isPending}
                      onClick={() => priorityMut.mutate({ id: selected.id, priority: p })}
                    >
                      {p}
                    </Button>
                  ))}
                </div>

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
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={reassignMut.isPending || !reassignId}
                    onClick={() => reassignMut.mutate({ id: selected.id, lawyerId: reassignId })}
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
                  <Button
                    size="sm"
                    className="rounded-xl"
                    disabled={sysMut.isPending || !sysMsg.trim()}
                    onClick={() => sysMut.mutate({ id: selected.id, body: sysMsg.trim() })}
                  >
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
                      onClick={() => cancelMut.mutate({ id: selected.id, reason: reason.trim() })}
                    >
                      Force cancel
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={completeMut.isPending || reason.trim().length < 3}
                      onClick={() => completeMut.mutate({ id: selected.id, reason: reason.trim() })}
                    >
                      Force complete
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Timeline</p>
                  <ol className="no-scrollbar mt-2 max-h-28 space-y-1 overflow-y-auto">
                    {detailQuery.data.events.map((event) => (
                      <li key={event.id} className="text-[11px] text-muted-foreground">
                        <span className="font-medium capitalize text-foreground">{event.type.replaceAll("_", " ")}</span>
                        {event.created_at ? ` · ${formatClock(event.created_at)}` : ""}
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live transcript</p>
                  {detailQuery.data.messages.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No messages yet.</p>
                  ) : (
                    <ol className="no-scrollbar mt-2 max-h-48 space-y-2 overflow-y-auto">
                      {detailQuery.data.messages.map((msg) => (
                        <li key={msg.id} className="rounded-lg bg-muted/30 px-2 py-1.5 text-[12px]">
                          <span className="text-[10px] capitalize text-muted-foreground">{msg.sender_role}</span>
                          {msg.attachment ? (
                            <AttachmentPreview appointmentId={selected.id} attachment={msg.attachment} mine={false} />
                          ) : null}
                          {msg.body && msg.sender_role !== "admin" ? <p className="mt-0.5">{msg.body}</p> : null}
                          {msg.sender_role === "admin" ? (
                            <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{msg.body}</p>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4" />
            Counsel listings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lawyersQuery.data && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Counsel</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lawyersQuery.data.map((lawyer) => (
                    <TableRow key={lawyer.id}>
                      <TableCell className="font-medium">{lawyer.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{lawyer.city}</TableCell>
                      <TableCell>{lawyer.is_verified || lawyer.verified ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          disabled={verifyMut.isPending}
                          onClick={() =>
                            verifyMut.mutate({
                              id: lawyer.id,
                              verified: !(lawyer.is_verified || lawyer.verified),
                            })
                          }
                        >
                          {lawyer.is_verified || lawyer.verified ? "Unverify" : "Verify"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
