"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Scale, Siren } from "lucide-react";

import { AppointmentQueue } from "@/components/admin/appointment-queue";
import { AdminOpsLayout, type AdminOpsTab } from "@/components/admin/admin-ops-layout";
import { LiveSessionMatrix } from "@/components/admin/live-session-matrix";
import { RoomAlertBanner } from "@/components/appointment-room/room-alert-banner";
import { useAdminOpsEvents } from "@/hooks/use-admin-ops-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { adminListAppointments, adminListLawyers, adminSetLawyerVerified } from "@/lib/api";
import type { AdminOpsEvent, AppointmentRecord } from "@/lib/appointment-types";
import {
  playAlertChime,
  requestNotificationPermission,
  showBrowserNotification,
  startEmergencyAlert,
  stopEmergencyAlert,
} from "@/lib/room-alerts";
import { cn } from "@/lib/utils";

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<AdminOpsTab>("live");
  const [status, setStatus] = useState("");
  const [liveFilter, setLiveFilter] = useState(false);
  const [emergencyFilter, setEmergencyFilter] = useState("");
  const [search, setSearch] = useState("");
  const [flashEmergencyId, setFlashEmergencyId] = useState<string | null>(null);
  const [liveEmergencies, setLiveEmergencies] = useState<Record<string, AppointmentRecord>>({});
  const lastEmergencyFlash = useRef<string | null>(null);
  const refreshTimer = useRef<number | null>(null);

  const navigateToAppointment = useCallback(
    (id: string, focus?: "sos") => {
      const qs = focus ? "?focus=sos" : "";
      router.push(`/admin/appointments/${id}${qs}`);
    },
    [router],
  );

  const refreshQueue = useCallback(
    (immediate = false) => {
      const run = () => {
        void queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
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
      stopEmergencyAlert();
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
          setTab("sos");
          void playAlertChime("emergency");
          showBrowserNotification(
            "SOS request",
            `${payload.citizen_name || "Citizen"} · ${payload.lawyer_name || "Counsel"}: ${payload.emergency_reason || "Help requested"}`,
          );
          setFlashEmergencyId(aptId);
          window.setTimeout(() => setFlashEmergencyId(null), 6000);
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
      if (row.emergency_status === "open" || row.emergency_status === "ack") map.set(row.id, row);
    }
    for (const [id, row] of Object.entries(liveEmergencies)) {
      if (row.emergency_status === "open" || row.emergency_status === "ack") {
        map.set(id, { ...map.get(id), ...row, id });
      }
    }
    return Array.from(map.values());
  }, [listQuery.data?.items, liveEmergencies]);

  const openSosCount = openEmergencies.filter((r) => r.emergency_status === "open").length;
  const highlightedSos = openEmergencies.find((row) => row.id === flashEmergencyId) ?? openEmergencies[0] ?? null;
  const emergencyCount = (emergencyCounts.open ?? 0) + (emergencyCounts.ack ?? 0);

  useEffect(() => {
    if (openSosCount > 0) {
      startEmergencyAlert();
    } else {
      stopEmergencyAlert();
    }
  }, [openSosCount]);

  const kpis = useMemo(
    () => [
      ["Upcoming", (counts.requested ?? 0) + (counts.confirmed ?? 0)],
      ["Live now", liveTotal],
      ["Emergencies", emergencyCount],
      ["Expired", counts.expired ?? 0],
    ],
    [counts, emergencyCount, liveTotal],
  );

  const verifyMut = useMutation({
    mutationFn: ({ id, verified }: { id: string; verified: boolean }) => adminSetLawyerVerified(id, verified),
    onSuccess: () => {
      toast({ title: "Listing updated", variant: "success" });
      void queryClient.invalidateQueries({ queryKey: ["admin-lawyers"] });
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const counselSection = (
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
  );

  return (
    <AdminOpsLayout
      tab={tab}
      onTabChange={setTab}
      opsLive={opsLive}
      emergencyCount={emergencyCount}
      liveTotal={liveTotal}
      moreContent={counselSection}
    >
      {highlightedSos && tab !== "sos" ? (
        <RoomAlertBanner
          kind="emergency"
          title="Live SOS request"
          body={`${highlightedSos.citizen_name} ↔ ${highlightedSos.lawyer_name}: ${highlightedSos.emergency_reason || "Help requested."}`}
          actionLabel="Open command center"
          onAction={() => navigateToAppointment(highlightedSos.id, "sos")}
        />
      ) : null}

      <div className="hidden gap-3 sm:grid-cols-2 lg:grid-cols-4 md:grid">
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

      {tab === "live" && (
        <LiveSessionMatrix
          sessions={liveSessions}
          liveTotal={liveTotal}
          loading={listQuery.isLoading}
          liveFilter={liveFilter}
          onToggleLiveFilter={() => setLiveFilter((v) => !v)}
          onSelect={(id) => navigateToAppointment(id)}
        />
      )}

      {tab === "queue" && (
        <AppointmentQueue
          items={listQuery.data?.items ?? []}
          total={listQuery.data?.total ?? 0}
          loading={listQuery.isLoading}
          error={listQuery.isError ? (listQuery.error as Error) : null}
          status={status}
          emergencyFilter={emergencyFilter}
          search={search}
          onStatusChange={setStatus}
          onEmergencyFilterChange={setEmergencyFilter}
          onSearchChange={setSearch}
          onSelect={(id) => navigateToAppointment(id)}
        />
      )}

      {tab === "sos" && (
        <div className="max-h-[calc(100dvh-280px)] space-y-3 overflow-y-auto">
          {openEmergencies.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No open emergency requests right now.
              </CardContent>
            </Card>
          ) : (
            openEmergencies.map((row) => (
              <Card
                key={row.id}
                className={cn(
                  "border-amber-500/30 transition hover:border-amber-500/50",
                  flashEmergencyId === row.id && "ring-2 ring-amber-500",
                )}
              >
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      <Siren className="h-4 w-4 text-amber-600" />
                      {row.citizen_name} ↔ {row.lawyer_name}
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">{row.emergency_reason || "Help requested"}</p>
                    <Badge variant="outline" className="mt-2 capitalize">
                      {row.emergency_status}
                    </Badge>
                  </div>
                  <Button className="rounded-xl" onClick={() => navigateToAppointment(row.id, "sos")}>
                    Manage SOS
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </AdminOpsLayout>
  );
}
