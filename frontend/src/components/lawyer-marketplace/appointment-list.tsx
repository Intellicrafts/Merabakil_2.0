"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarDays, Clock3, FileText, Sparkles, X } from "lucide-react";

import { LiveClock } from "@/components/ui/live-clock";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useAppointmentSummonWatcher } from "@/hooks/use-appointment-summon-watcher";
import { cancelAppointment, confirmAppointment, getStoredUser, rejectAppointment } from "@/lib/api";
import {
  appointmentClock,
  formatCountdown,
  liveJoinPhase,
  secondsUntil,
} from "@/lib/appointment-format";
import type { AppointmentRecord } from "@/lib/appointment-types";
import type { AppointmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  requested: "border-transparent bg-amber-500/10 text-amber-800 dark:text-amber-300",
  confirmed: "border-transparent bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  live: "border-transparent bg-sky-500/10 text-sky-800 dark:text-sky-300",
  completed: "border-transparent bg-slate-500/10 text-slate-700 dark:text-slate-300",
  expired: "border-transparent bg-slate-500/10 text-slate-700 dark:text-slate-300",
  cancelled: "border-transparent bg-red-500/10 text-red-700 dark:text-red-300",
  no_show: "border-transparent bg-red-500/10 text-red-700 dark:text-red-300",
};

interface AppointmentListProps {
  appointments: AppointmentRecord[];
  onChanged?: () => void;
}

export function AppointmentList({ appointments, onChanged }: AppointmentListProps) {
  const user = useMemo(() => getStoredUser(), []);

  useAppointmentSummonWatcher({ appointments });
  const isAdvocate = Boolean(user?.roles.includes("advocate") || user?.roles.includes("admin"));

  const asLawyer = (a: AppointmentRecord) =>
    a.my_role === "lawyer" || (isAdvocate && user?.user_id === a.lawyer_user_id);

  return (
    <LiveClock>
      {(now) => {
        const pending = appointments.filter((a) => asLawyer(a) && a.status === "requested");
        const inbox = appointments.filter(
          (a) => asLawyer(a) && ["confirmed", "live"].includes(a.status),
        );
        const schedule = appointments.filter(
          (a) => asLawyer(a) && !["requested", "confirmed", "live"].includes(a.status),
        );
        const mine = appointments.filter((a) => !asLawyer(a));
        const upcoming = appointments.filter(
          (a) => liveJoinPhase(a, now) !== "expired" && a.status !== "cancelled",
        );
        const past = appointments.filter(
          (a) => liveJoinPhase(a, now) === "expired" || a.status === "cancelled",
        );

        if (appointments.length === 0) {
          return (
            <div className="rounded-3xl border border-dashed border-black/[0.08] bg-white/30 py-20 text-center dark:border-white/10 dark:bg-white/[0.02]">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]">
                <CalendarDays className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-semibold">No appointments yet</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                Book a consultation from Top Lawyers — your inbox will appear here.
              </p>
            </div>
          );
        }

        return (
          <div className="space-y-8">
            {isAdvocate ? (
              <>
                {pending.length > 0 && (
                  <PendingSection items={pending} now={now} onChanged={onChanged} />
                )}
                <Section title="Confirmed" items={inbox} now={now} onChanged={onChanged} />
                <Section title="Past" items={schedule} now={now} onChanged={onChanged} />
                {mine.length > 0 && (
                  <Section title="My consultations" items={mine} now={now} onChanged={onChanged} />
                )}
              </>
            ) : (
              <>
                <Section title="My consultations" items={upcoming} now={now} onChanged={onChanged} />
                <Section title="Past" items={past} now={now} onChanged={onChanged} />
              </>
            )}
          </div>
        );
      }}
    </LiveClock>
  );
}

// ── Pending requests section for lawyers ────────────────────────────────────

function PendingSection({
  items,
  now,
  onChanged,
}: {
  items: AppointmentRecord[];
  now: number;
  onChanged?: () => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Pending Requests
        </h3>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-800 dark:text-amber-300">
          {items.length}
        </span>
      </div>
      <ul className="space-y-3">
        {items.map((apt, i) => (
          <PendingRow key={apt.id} apt={apt} now={now} index={i} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

function PendingRow({
  apt,
  now,
  index,
  onChanged,
}: {
  apt: AppointmentRecord;
  now: number;
  index: number;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function handleAccept() {
    setBusy("accept");
    try {
      await confirmAppointment(apt.id);
      toast({ title: "Appointment accepted", variant: "success" });
      onChanged?.();
    } catch (err) {
      toast({ title: "Could not accept", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;
    setBusy("reject");
    try {
      await rejectAppointment(apt.id, rejectReason.trim());
      toast({ title: "Appointment rejected" });
      onChanged?.();
    } catch (err) {
      toast({ title: "Could not reject", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
      setShowRejectInput(false);
    }
  }

  return (
    <li
      style={{ animationDelay: `${index * 50}ms` }}
      className="mp-card-enter rounded-2xl border border-amber-200/60 bg-amber-50/60 p-4 backdrop-blur-xl dark:border-amber-700/30 dark:bg-amber-900/10"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold tracking-tight">{apt.counterpart_name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Client</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {appointmentClock(apt.scheduled_at)} · {apt.time_slot}
          </p>
        </div>
        <Badge className={STATUS_STYLES.requested}>Pending review</Badge>
      </div>

      <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {apt.matter_summary}
      </p>

      {/* Case brief access */}
      {apt.case_id && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-violet-700 dark:text-violet-300">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>AI case brief available —</span>
          <Link
            href={`/appointments/${apt.id}`}
            className="underline underline-offset-2"
          >
            view before deciding
          </Link>
        </div>
      )}

      {/* Reject reason input */}
      {showRejectInput && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium">Reason for rejecting</p>
            <button
              type="button"
              onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            placeholder="e.g. Schedule conflict, outside my practice area…"
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            disabled={!rejectReason.trim() || busy === "reject"}
            onClick={() => void handleReject()}
            className="inline-flex h-8 items-center rounded-lg bg-red-600 px-4 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {busy === "reject" ? "Rejecting…" : "Confirm rejection"}
          </button>
        </div>
      )}

      {!showRejectInput && (
        <div className="mt-3.5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void handleAccept()}
            className="mp-btn-accent inline-flex h-9 items-center rounded-xl px-4 text-[12px] font-semibold"
          >
            {busy === "accept" ? "Accepting…" : "Accept"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setShowRejectInput(true)}
            className="inline-flex h-9 items-center rounded-xl border border-red-200 px-4 text-[12px] font-semibold text-red-700 dark:border-red-900/40 dark:text-red-300"
          >
            Reject
          </button>
          <Link
            href={`/appointments/${apt.id}`}
            className="mp-btn-soft inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[12px] font-semibold"
          >
            <FileText className="h-3.5 w-3.5" />
            View details
          </Link>
        </div>
      )}
    </li>
  );
}

// ── Regular section ──────────────────────────────────────────────────────────

function Section({
  title,
  items,
  now,
  onChanged,
}: {
  title: string;
  items: AppointmentRecord[];
  now: number;
  onChanged?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((apt, i) => (
          <AppointmentRow key={apt.id} apt={apt} now={now} index={i} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

function AppointmentRow({
  apt,
  now,
  index,
  onChanged,
}: {
  apt: AppointmentRecord;
  now: number;
  index: number;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<"cancel" | null>(null);
  const phase = liveJoinPhase(apt, now);
  const roleLabel = apt.my_role === "lawyer" ? "Citizen" : "Counsel";
  const untilStart = secondsUntil(apt.scheduled_at, now);
  const untilEnd = secondsUntil(apt.scheduled_end_at, now);
  const canAct = !["completed", "expired", "no_show", "cancelled"].includes(apt.status);
  const isRejoin =
    apt.prior_join ||
    (apt.metrics?.citizen_join_count ?? 0) > 0 ||
    (apt.metrics?.lawyer_join_count ?? 0) > 0 ||
    apt.status === "live";
  const joinLabel = phase === "joinable" ? (isRejoin ? "Rejoin room" : "Join room") : "Join room";

  async function handleCancel() {
    setBusy("cancel");
    try {
      await cancelAppointment(apt.id);
      toast({ title: "Appointment cancelled" });
      onChanged?.();
    } catch (err) {
      toast({ title: "Could not cancel", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <li
      style={{ animationDelay: `${index * 50}ms` }}
      className={cn(
        "mp-card-enter rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
        "transition-all duration-300 hover:border-slate-300/50 hover:shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
        "dark:border-white/[0.08] dark:bg-white/[0.04]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold tracking-tight">{apt.counterpart_name || apt.lawyer_name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{roleLabel}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {appointmentClock(apt.scheduled_at)} · {apt.time_slot}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge className={cn("capitalize", STATUS_STYLES[apt.status] ?? STATUS_STYLES.confirmed)}>
            {apt.status.replace("_", " ")}
          </Badge>
          {apt.pending_summon ? (
            <Badge className="border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200">Join request</Badge>
          ) : null}
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
        {apt.matter_summary}
      </p>
      {phase === "upcoming" && (
        <p className="mt-3 text-[12px] font-medium tabular-nums text-slate-600 dark:text-slate-300">
          Join unlocks in {formatCountdown(untilStart)}
        </p>
      )}
      {phase === "joinable" && (
        <p className="mt-3 text-[12px] font-medium tabular-nums text-emerald-700 dark:text-emerald-300">
          Window open · {formatCountdown(untilEnd)} remaining
          {apt.opponent_present ? " · Counsel waiting in room" : ""}
        </p>
      )}
      <div className="mt-3.5 flex flex-wrap gap-2">
        {phase === "joinable" ? (
          <Link
            href={`/appointments/${apt.id}/room`}
            className="mp-btn-primary inline-flex h-9 items-center rounded-xl px-4 text-[12px] font-semibold"
          >
            {joinLabel}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-9 items-center rounded-xl border border-black/[0.06] px-4 text-[12px] font-semibold text-muted-foreground/70 dark:border-white/10"
          >
            Join room
          </button>
        )}
        <Link
          href={`/appointments/${apt.id}`}
          className="mp-btn-soft inline-flex h-9 items-center rounded-xl px-4 text-[12px] font-semibold"
        >
          Details
        </Link>
        {canAct && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void handleCancel()}
            className="inline-flex h-9 items-center rounded-xl border border-red-200 px-4 text-[12px] font-semibold text-red-700 dark:border-red-900/40 dark:text-red-300"
          >
            {busy === "cancel" ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
    </li>
  );
}
