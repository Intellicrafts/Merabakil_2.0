import type { AppointmentRecord } from "@/lib/appointment-types";

const CLOSED = new Set(["cancelled", "completed", "expired", "no_show"]);

export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function appointmentClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function liveJoinPhase(
  apt: Pick<AppointmentRecord, "scheduled_at" | "scheduled_end_at" | "status" | "join_state">,
  nowMs = Date.now(),
): "upcoming" | "joinable" | "expired" {
  if (CLOSED.has(apt.status)) return "expired";
  const start = apt.scheduled_at ? new Date(apt.scheduled_at).getTime() : NaN;
  const end = apt.scheduled_end_at ? new Date(apt.scheduled_end_at).getTime() : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return apt.join_state;
  if (nowMs < start) return "upcoming";
  if (nowMs <= end) return "joinable";
  return "expired";
}

export function secondsUntil(iso: string | null | undefined, nowMs = Date.now()): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - nowMs) / 1000));
}
