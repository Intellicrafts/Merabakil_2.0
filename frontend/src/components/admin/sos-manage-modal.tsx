"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  ExternalLink,
  MessageSquare,
  Radio,
  ShieldAlert,
  Siren,
  UserMinus,
  UserX,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  adminAckEmergency,
  adminExtendAppointment,
  adminForceSummon,
  adminGetAppointment,
  adminKickParticipant,
  adminResolveEmergency,
  adminSuspendParticipant,
  adminSystemMessage,
  adminUnsuspendParticipant,
} from "@/lib/api";
import type { AppointmentRecord, ModerationState } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

interface SosManageModalProps {
  appointmentId: string | null;
  onClose: () => void;
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function elapsedSince(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function isActiveSuspend(mod: ModerationState | undefined): boolean {
  if (!mod || mod.status !== "suspended") return false;
  if (!mod.suspended_until) return true;
  return new Date(mod.suspended_until).getTime() > Date.now();
}

function PresenceDot({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        on ? "bg-emerald-500" : "bg-muted-foreground/30",
      )}
      aria-label={on ? "Present" : "Away"}
    />
  );
}

type PendingAction =
  | { kind: "kick"; target: "citizen" | "lawyer" }
  | { kind: "suspend"; target: "citizen" | "lawyer"; minutes: 5 | 15 | 30 };

interface PartyCardProps {
  label: string;
  name: string;
  present: boolean;
  moderation?: ModerationState;
  onKick: () => void;
  onSuspend: (minutes: 5 | 15 | 30) => void;
  onUnsuspend: () => void;
  pendingAction: PendingAction | null;
  confirmReason: string;
  onConfirmReasonChange: (v: string) => void;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  busy: boolean;
}

function PartyCard({
  label,
  name,
  present,
  moderation,
  onKick,
  onSuspend,
  onUnsuspend,
  pendingAction,
  confirmReason,
  onConfirmReasonChange,
  onConfirm,
  onCancelConfirm,
  busy,
}: PartyCardProps) {
  const suspended = isActiveSuspend(moderation);
  const kicked = moderation?.status === "kicked";
  const showConfirm = pendingAction !== null;

  return (
    <div className="rounded-xl border border-black/[0.06] bg-muted/20 p-3 dark:border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="truncate font-medium">{name}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
          <PresenceDot on={present} />
          <span className="text-muted-foreground">{present ? "In room" : "Away"}</span>
        </div>
      </div>

      {suspended ? (
        <div className="mt-2 rounded-lg border border-rose-500/30 bg-rose-50/80 px-2.5 py-2 text-[11px] dark:bg-rose-950/20">
          <p className="font-semibold text-rose-800 dark:text-rose-200">Temporarily suspended</p>
          {moderation?.suspended_until ? (
            <p className="mt-0.5 text-rose-700/80 dark:text-rose-300/80">Until {formatClock(moderation.suspended_until)}</p>
          ) : null}
          {moderation?.reason ? <p className="mt-0.5 opacity-80">{moderation.reason}</p> : null}
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 rounded-lg text-[11px]"
            disabled={busy}
            onClick={onUnsuspend}
          >
            Lift suspend
          </Button>
        </div>
      ) : kicked && moderation?.reason ? (
        <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-200">Recently removed · {moderation.reason}</p>
      ) : null}

      {!showConfirm ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-lg text-[11px]"
            disabled={busy || !present}
            onClick={onKick}
          >
            <UserMinus className="mr-1 h-3 w-3" />
            Remove
          </Button>
          {[5, 15, 30].map((m) => (
            <Button
              key={m}
              size="sm"
              variant="outline"
              className="h-7 rounded-lg text-[11px] text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
              disabled={busy || !present}
              onClick={() => onSuspend(m as 5 | 15 | 30)}
            >
              <UserX className="mr-1 h-3 w-3" />
              {m}m
            </Button>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2 rounded-lg border border-amber-500/30 bg-amber-50/60 p-2.5 dark:bg-amber-950/20">
          <p className="text-[11px] font-semibold text-amber-950 dark:text-amber-100">
            {pendingAction.kind === "kick"
              ? `Remove ${name} from conference?`
              : `Suspend ${name} for ${pendingAction.minutes} minutes?`}
          </p>
          {pendingAction.kind === "suspend" ? (
            <Input
              value={confirmReason}
              onChange={(e) => onConfirmReasonChange(e.target.value)}
              placeholder="Reason (required)"
              className="h-8 rounded-lg text-[12px]"
            />
          ) : (
            <Input
              value={confirmReason}
              onChange={(e) => onConfirmReasonChange(e.target.value)}
              placeholder="Reason (optional)"
              className="h-8 rounded-lg text-[12px]"
            />
          )}
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" className="h-7 flex-1 rounded-lg text-[11px]" onClick={onCancelConfirm}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 flex-1 rounded-lg bg-rose-600 text-[11px] text-white hover:bg-rose-700"
              disabled={busy || (pendingAction.kind === "suspend" && confirmReason.trim().length < 3)}
              onClick={onConfirm}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SosManageModal({ appointmentId, onClose }: SosManageModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sysMsg, setSysMsg] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmReason, setConfirmReason] = useState("");

  const detailQuery = useQuery({
    queryKey: ["admin-appointment", appointmentId],
    queryFn: () => adminGetAppointment(appointmentId!),
    enabled: Boolean(appointmentId),
    refetchInterval: (q) => {
      const apt = q.state.data?.appointment;
      return apt && (apt.status === "live" || apt.emergency_status === "open" || apt.emergency_status === "ack")
        ? 2000
        : false;
    },
  });

  const apt = detailQuery.data?.appointment;
  const events = detailQuery.data?.events ?? [];

  useEffect(() => {
    if (!appointmentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [appointmentId, onClose]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-appointment", appointmentId] });
  }

  const ackMut = useMutation({
    mutationFn: adminAckEmergency,
    onSuccess: () => {
      toast({ title: "SOS acknowledged" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Ack failed", description: err.message, variant: "destructive" }),
  });

  const resolveMut = useMutation({
    mutationFn: adminResolveEmergency,
    onSuccess: () => {
      toast({ title: "SOS resolved" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Resolve failed", description: err.message, variant: "destructive" }),
  });

  const extendMut = useMutation({
    mutationFn: ({ minutes }: { minutes: number }) => adminExtendAppointment(appointmentId!, minutes),
    onSuccess: () => {
      toast({ title: "Window extended" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Extend failed", description: err.message, variant: "destructive" }),
  });

  const summonMut = useMutation({
    mutationFn: () => adminForceSummon(appointmentId!),
    onSuccess: () => {
      toast({ title: "Summon sent" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Summon failed", description: err.message, variant: "destructive" }),
  });

  const sysMut = useMutation({
    mutationFn: (body: string) => adminSystemMessage(appointmentId!, body),
    onSuccess: () => {
      toast({ title: "Ops message sent" });
      setSysMsg("");
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Message failed", description: err.message, variant: "destructive" }),
  });

  const kickMut = useMutation({
    mutationFn: ({ target, reason }: { target: "citizen" | "lawyer"; reason: string }) =>
      adminKickParticipant(appointmentId!, target, reason),
    onSuccess: () => {
      toast({ title: "Participant removed from conference" });
      setPendingAction(null);
      setConfirmReason("");
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Remove failed", description: err.message, variant: "destructive" }),
  });

  const suspendMut = useMutation({
    mutationFn: ({
      target,
      minutes,
      reason,
    }: {
      target: "citizen" | "lawyer";
      minutes: 5 | 15 | 30;
      reason: string;
    }) => adminSuspendParticipant(appointmentId!, target, minutes, reason),
    onSuccess: () => {
      toast({ title: "Participant suspended" });
      setPendingAction(null);
      setConfirmReason("");
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Suspend failed", description: err.message, variant: "destructive" }),
  });

  const unsuspendMut = useMutation({
    mutationFn: (target: "citizen" | "lawyer") => adminUnsuspendParticipant(appointmentId!, target),
    onSuccess: () => {
      toast({ title: "Suspension lifted" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "Lift failed", description: err.message, variant: "destructive" }),
  });

  const moderationBusy = kickMut.isPending || suspendMut.isPending || unsuspendMut.isPending;

  const recentEvents = useMemo(() => [...events].slice(-8).reverse(), [events]);

  function handleConfirmModeration() {
    if (!pendingAction || !appointmentId) return;
    if (pendingAction.kind === "kick") {
      kickMut.mutate({ target: pendingAction.target, reason: confirmReason.trim() });
      return;
    }
    suspendMut.mutate({
      target: pendingAction.target,
      minutes: pendingAction.minutes,
      reason: confirmReason.trim(),
    });
  }

  if (!appointmentId) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sos-manage-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close SOS manage modal"
      />

      <div className="relative z-[101] flex max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-black/[0.08] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-zinc-950 sm:max-h-[90vh] sm:rounded-2xl">
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-amber-600 via-orange-600 to-rose-700 px-5 py-5 text-white">
          <Siren className="pointer-events-none absolute -right-2 -top-2 h-24 w-24 opacity-[0.12]" aria-hidden />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">SOS incident control</p>
              <h2 id="sos-manage-title" className="mt-0.5 text-lg font-semibold tracking-tight sm:text-xl">
                {apt ? `${apt.citizen_name} ↔ ${apt.lawyer_name}` : "Loading…"}
              </h2>
              {apt ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className="border-0 bg-white/20 capitalize text-white hover:bg-white/20">
                    SOS {apt.emergency_status}
                  </Badge>
                  {apt.emergency_at ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-white/75">
                      <Clock className="h-3 w-3" />
                      Opened {elapsedSince(apt.emergency_at)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            {apt && (apt.status === "live" || apt.join_state === "joinable") ? (
              <Link
                href={`/appointments/${apt.id}/room`}
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-white/15 px-3 text-[11px] font-semibold backdrop-blur-sm transition hover:bg-white/25"
              >
                <ExternalLink className="h-3 w-3" />
                Observe room
              </Link>
            ) : null}
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {detailQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : apt ? (
            <div className="space-y-5">
              {/* Incident */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Incident details
                </h3>
                <div className="rounded-xl border border-amber-500/25 bg-amber-50/50 p-3 dark:bg-amber-950/15">
                  <p className="text-[13px] leading-relaxed">
                    {apt.emergency_reason || "Help requested in the appointment room."}
                  </p>
                  <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                    <p>Opened: {formatClock(apt.emergency_at)}</p>
                    <p>Acknowledged: {formatClock(apt.emergency_ack_at)}</p>
                  </div>
                </div>
              </section>

              {/* Conference parties */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Radio className="h-3.5 w-3.5" />
                  Conference moderation
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <PartyCard
                    label="Citizen"
                    name={apt.citizen_name}
                    present={Boolean(apt.citizen_present)}
                    moderation={apt.citizen_moderation}
                    pendingAction={pendingAction?.target === "citizen" ? pendingAction : null}
                    confirmReason={confirmReason}
                    onConfirmReasonChange={setConfirmReason}
                    onKick={() => {
                      setPendingAction({ kind: "kick", target: "citizen" });
                      setConfirmReason("");
                    }}
                    onSuspend={(minutes) => {
                      setPendingAction({ kind: "suspend", target: "citizen", minutes });
                      setConfirmReason("");
                    }}
                    onUnsuspend={() => unsuspendMut.mutate("citizen")}
                    onConfirm={handleConfirmModeration}
                    onCancelConfirm={() => {
                      setPendingAction(null);
                      setConfirmReason("");
                    }}
                    busy={moderationBusy}
                  />
                  <PartyCard
                    label="Counsel"
                    name={apt.lawyer_name}
                    present={Boolean(apt.lawyer_present)}
                    moderation={apt.lawyer_moderation}
                    pendingAction={pendingAction?.target === "lawyer" ? pendingAction : null}
                    confirmReason={confirmReason}
                    onConfirmReasonChange={setConfirmReason}
                    onKick={() => {
                      setPendingAction({ kind: "kick", target: "lawyer" });
                      setConfirmReason("");
                    }}
                    onSuspend={(minutes) => {
                      setPendingAction({ kind: "suspend", target: "lawyer", minutes });
                      setConfirmReason("");
                    }}
                    onUnsuspend={() => unsuspendMut.mutate("lawyer")}
                    onConfirm={handleConfirmModeration}
                    onCancelConfirm={() => {
                      setPendingAction(null);
                      setConfirmReason("");
                    }}
                    busy={moderationBusy}
                  />
                </div>
              </section>

              {/* Response actions */}
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Response actions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {apt.emergency_status === "open" ? (
                    <Button
                      size="sm"
                      className="rounded-xl"
                      disabled={ackMut.isPending}
                      onClick={() => ackMut.mutate(apt.id)}
                    >
                      Acknowledge SOS
                    </Button>
                  ) : null}
                  {(apt.emergency_status === "open" || apt.emergency_status === "ack") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      disabled={resolveMut.isPending}
                      onClick={() => resolveMut.mutate(apt.id)}
                    >
                      Resolve SOS
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={summonMut.isPending}
                    onClick={() => summonMut.mutate()}
                  >
                    Force summon
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => extendMut.mutate({ minutes: 5 })}
                  >
                    +5 min
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => extendMut.mutate({ minutes: 10 })}
                  >
                    +10 min
                  </Button>
                </div>
              </section>

              {/* Ops message */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Ops message
                </h3>
                <div className="flex gap-2">
                  <Input
                    value={sysMsg}
                    onChange={(e) => setSysMsg(e.target.value)}
                    placeholder="Message to both parties in the room"
                    className="h-9 flex-1 rounded-xl text-[13px]"
                  />
                  <Button
                    size="sm"
                    className="shrink-0 rounded-xl"
                    disabled={sysMut.isPending || !sysMsg.trim()}
                    onClick={() => sysMut.mutate(sysMsg.trim())}
                  >
                    Send
                  </Button>
                </div>
              </section>

              {/* Timeline */}
              {recentEvents.length > 0 ? (
                <section>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Recent activity
                  </h3>
                  <ol className="space-y-1 rounded-xl border border-black/[0.06] bg-muted/20 p-3 dark:border-white/10">
                    {recentEvents.map((event) => (
                      <li key={event.id} className="flex items-baseline gap-2 text-[11px]">
                        <span className="shrink-0 capitalize font-medium text-foreground">
                          {event.type.replaceAll("_", " ")}
                        </span>
                        {event.created_at ? (
                          <span className="text-muted-foreground">{formatClock(event.created_at)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Could not load appointment details.</p>
          )}
        </div>
      </div>
    </div>
  );
}
