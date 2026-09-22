"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  FileText,
  History,
  Inbox,
  Sparkles,
  Timer,
  Video,
  X,
} from "lucide-react";

import {
  AppointmentStatusBadge,
  JoinRequestBadge,
} from "@/components/lawyer-marketplace/appointment-status-badge";
import { LawyerAvatar } from "@/components/lawyer-marketplace/lawyer-avatar";
import { LiveClock } from "@/components/ui/live-clock";
import { useToast } from "@/components/ui/toast";
import { useAppointmentSummonWatcher } from "@/hooks/use-appointment-summon-watcher";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { cancelAppointment, confirmAppointment, getStoredUser, rejectAppointment } from "@/lib/api";
import {
  appointmentClock,
  formatCountdown,
  liveJoinPhase,
  secondsUntil,
} from "@/lib/appointment-format";
import type { AppointmentRecord } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

const INFINITE_SCROLL_THRESHOLD = 8;
const PAGE_SIZE = 8;

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

  const resetKey = appointments.map((a) => a.id).join(",");
  const usePagination = appointments.length > INFINITE_SCROLL_THRESHOLD;
  const { visibleCount, sentinelRef, hasMore } = useInfiniteScroll(
    appointments.length,
    resetKey,
    PAGE_SIZE,
  );

  return (
    <LiveClock>
      {(now) => {
        if (appointments.length === 0) {
          return (
            <div className="mp-surface-card rounded-[1.4rem] px-5 py-14 text-center sm:rounded-3xl sm:py-20">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]">
                {isAdvocate ? (
                  <Inbox className="h-6 w-6 text-muted-foreground/60" />
                ) : (
                  <CalendarDays className="h-6 w-6 text-muted-foreground/60" />
                )}
              </div>
              <p className="text-sm font-semibold">No consultations yet</p>
              {isAdvocate ? (
                <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                  When a client books a consultation with you, it will appear here for you to
                  confirm and join.
                </p>
              ) : (
                <>
                  <p className="mx-auto mt-1.5 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                    Find a verified advocate and book a session — it will appear here once confirmed.
                  </p>
                  <Link
                    href="/lawyer-marketplace"
                    className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 text-[13px] font-semibold text-background transition-opacity hover:opacity-80"
                  >
                    Find an Advocate
                  </Link>
                </>
              )}
            </div>
          );
        }

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

        let budget = usePagination ? visibleCount : appointments.length;

        function take<T>(items: T[]): T[] {
          if (!usePagination) return items;
          const slice = items.slice(0, budget);
          budget -= slice.length;
          return slice;
        }

        return (
          <div className="space-y-8">
            {isAdvocate ? (
              <>
                {pending.length > 0 && (
                  <PendingSection items={take(pending)} onChanged={onChanged} />
                )}
                <Section
                  title="Confirmed"
                  icon={CalendarDays}
                  items={take(inbox)}
                  now={now}
                  onChanged={onChanged}
                />
                <Section title="Past" icon={History} items={take(schedule)} now={now} onChanged={onChanged} />
                {mine.length > 0 && (
                  <Section
                    title="My consultations"
                    icon={CalendarDays}
                    items={take(mine)}
                    now={now}
                    onChanged={onChanged}
                  />
                )}
              </>
            ) : (
              <>
                <Section
                  title="My consultations"
                  icon={CalendarDays}
                  items={take(upcoming)}
                  now={now}
                  onChanged={onChanged}
                />
                <Section title="Past" icon={History} items={take(past)} now={now} onChanged={onChanged} />
              </>
            )}

            {usePagination && hasMore && (
              <div ref={sentinelRef} className="flex justify-center py-4">
                <div className="h-8 w-8 animate-pulse rounded-full border-2 border-black/10 border-t-foreground/40 dark:border-white/10 dark:border-t-white/50" />
              </div>
            )}
            {usePagination && !hasMore && appointments.length > PAGE_SIZE && (
              <p className="py-2 text-center text-[12px] text-muted-foreground">
                All consultations loaded
              </p>
            )}
          </div>
        );
      }}
    </LiveClock>
  );
}

function SectionHeading({
  title,
  icon: Icon,
  count,
}: {
  title: string;
  icon: typeof Inbox;
  count?: number;
}) {
  return (
    <div className="mp-section-heading">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/[0.04] dark:bg-white/[0.08]">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.85} />
      </span>
      <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
      {count != null && count > 0 && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-[10px] font-bold text-background">
          {count}
        </span>
      )}
    </div>
  );
}

function PendingSection({
  items,
  onChanged,
}: {
  items: AppointmentRecord[];
  onChanged?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeading title="Pending requests" icon={Inbox} count={items.length} />
      <ul className="space-y-3">
        {items.map((apt, i) => (
          <PendingRow key={apt.id} apt={apt} index={i} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

function PendingRow({
  apt,
  index,
  onChanged,
}: {
  apt: AppointmentRecord;
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
      className="mp-card-enter mp-surface-card relative overflow-hidden rounded-[1.2rem] p-4 sm:p-5"
    >
      <span className="mp-verified-strip" aria-hidden />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <LawyerAvatar
            name={apt.counterpart_name}
            lawyer={{ id: apt.lawyer_id, slug: apt.lawyer_slug, full_name: apt.counterpart_name }}
            className="h-12 w-12 sm:h-[3.25rem] sm:w-[3.25rem]"
            rounded="full"
          />
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">{apt.counterpart_name}</p>
            <span className="mt-1 inline-flex rounded-full border border-black/[0.06] bg-black/[0.03] px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.05]">
              Client
            </span>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
              {appointmentClock(apt.scheduled_at)}
              <Clock3 className="ml-1 h-3.5 w-3.5 shrink-0" />
              {apt.time_slot}
            </p>
          </div>
        </div>
        <AppointmentStatusBadge status="requested" />
      </div>

      <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
        {apt.matter_summary}
      </p>

      {apt.case_id && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-foreground/50" />
          <Link href={`/appointments/${apt.id}`} className="font-medium underline-offset-2 hover:underline">
            View AI case brief
          </Link>
        </div>
      )}

      {showRejectInput && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium">Reason for rejecting</p>
            <button
              type="button"
              onClick={() => {
                setShowRejectInput(false);
                setRejectReason("");
              }}
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
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            disabled={!rejectReason.trim() || busy === "reject"}
            onClick={() => void handleReject()}
            className="mp-btn-accent inline-flex h-11 min-h-11 items-center gap-1.5 rounded-xl px-4 text-[12px] font-semibold disabled:opacity-50 sm:h-10 sm:min-h-10"
          >
            <X className="h-3.5 w-3.5" />
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
            className="mp-btn-accent inline-flex h-11 min-h-11 items-center gap-1.5 rounded-xl px-4 text-[12px] font-semibold sm:h-10 sm:min-h-10"
          >
            <Check className="h-3.5 w-3.5" />
            {busy === "accept" ? "Accepting…" : "Accept"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setShowRejectInput(true)}
            className="mp-btn-primary inline-flex h-11 min-h-11 items-center gap-1.5 rounded-xl px-4 text-[12px] font-semibold sm:h-10 sm:min-h-10"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
          <Link
            href={`/appointments/${apt.id}`}
            className="mp-btn-soft inline-flex h-11 min-h-11 items-center gap-1.5 rounded-xl px-4 text-[12px] font-semibold sm:h-10 sm:min-h-10"
          >
            <FileText className="h-3.5 w-3.5" />
            Details
          </Link>
        </div>
      )}
    </li>
  );
}

function Section({
  title,
  icon,
  items,
  now,
  onChanged,
}: {
  title: string;
  icon: typeof Inbox;
  items: AppointmentRecord[];
  now: number;
  onChanged?: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHeading title={title} icon={icon} count={items.length} />
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
  const isLiveCard = phase === "joinable" || apt.status === "live";

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
        "mp-card-enter mp-surface-card relative overflow-hidden rounded-[1.2rem] p-4 sm:p-5",
        "transition-[border-color,box-shadow,transform] duration-200 sm:hover:-translate-y-0.5",
      )}
    >
      {isLiveCard && <span className="mp-live-strip" aria-hidden />}

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <LawyerAvatar
            name={apt.counterpart_name || apt.lawyer_name}
            lawyer={{
              id: apt.lawyer_id,
              slug: apt.lawyer_slug,
              full_name: apt.counterpart_name || apt.lawyer_name,
            }}
            className="h-12 w-12 sm:h-[3.25rem] sm:w-[3.25rem]"
            rounded="full"
          />
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">{apt.counterpart_name || apt.lawyer_name}</p>
            <span className="mt-1 inline-flex rounded-full border border-black/[0.06] bg-black/[0.03] px-2 py-0.5 text-[10px] font-medium text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.05]">
              {roleLabel}
            </span>
            <p className="mt-1.5 inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                {appointmentClock(apt.scheduled_at)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                {apt.time_slot}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <AppointmentStatusBadge status={apt.status} />
          {apt.pending_summon ? <JoinRequestBadge /> : null}
        </div>
      </div>

      <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
        {apt.matter_summary}
      </p>

      {phase === "upcoming" && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium tabular-nums text-muted-foreground">
          <Timer className="h-3.5 w-3.5 shrink-0" />
          Join unlocks in {formatCountdown(untilStart)}
        </p>
      )}
      {phase === "joinable" && (
        <p className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-medium tabular-nums text-muted-foreground">
          <Video className="h-3.5 w-3.5 shrink-0" />
          Window open · {formatCountdown(untilEnd)} left
          {apt.opponent_present ? " · Counsel in room" : ""}
        </p>
      )}

      <div className="mt-3.5 flex flex-wrap gap-2">
        {phase === "joinable" ? (
          <Link
            href={`/appointments/${apt.id}/room`}
            className="mp-btn-accent inline-flex h-11 min-h-11 items-center gap-1.5 rounded-xl px-4 text-[12px] font-semibold sm:h-10 sm:min-h-10"
          >
            <Video className="h-3.5 w-3.5" />
            {joinLabel}
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-11 min-h-11 items-center gap-1.5 rounded-xl border border-black/[0.06] px-4 text-[12px] font-semibold text-muted-foreground/70 dark:border-white/10 sm:h-10 sm:min-h-10"
          >
            <Video className="h-3.5 w-3.5" />
            Join room
          </button>
        )}
        <Link
          href={`/appointments/${apt.id}`}
          className="mp-btn-soft inline-flex h-11 min-h-11 items-center gap-1.5 rounded-xl px-4 text-[12px] font-semibold sm:h-10 sm:min-h-10"
        >
          <FileText className="h-3.5 w-3.5" />
          Details
        </Link>
        {canAct && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void handleCancel()}
            className="inline-flex h-11 min-h-11 items-center gap-1.5 rounded-xl border border-black/[0.07] px-4 text-[12px] font-medium text-muted-foreground transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-white/[0.10] dark:hover:border-red-700/40 dark:hover:bg-red-950/30 dark:hover:text-red-400 sm:h-10 sm:min-h-10"
          >
            <X className="h-3.5 w-3.5" />
            {busy === "cancel" ? "Cancelling…" : "Cancel"}
          </button>
        )}
      </div>
    </li>
  );
}
