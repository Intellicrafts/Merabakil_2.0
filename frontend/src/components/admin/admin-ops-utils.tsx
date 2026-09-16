"use client";

import { cn } from "@/lib/utils";

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PresenceDot({ on }: { on: boolean }) {
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

export function healthRingClass(issues: string[]): string {
  if (issues.includes("active_emergency")) return "ring-red-500/60";
  if (issues.includes("citizen_not_present") || issues.includes("lawyer_not_present")) return "ring-amber-500/60";
  if (issues.includes("livekit_unconfigured")) return "ring-orange-400/50";
  return "ring-emerald-500/50";
}

export const ISSUE_LABELS: Record<string, string> = {
  citizen_not_present: "Citizen not in room",
  lawyer_not_present: "Counsel not in room",
  livekit_unconfigured: "LiveKit unavailable — chat-only mode",
  citizen_not_in_livekit: "Citizen not connected to video",
  lawyer_not_in_livekit: "Counsel not connected to video",
  active_emergency: "Active SOS request",
  call_stuck_ringing: "Call stuck ringing",
  window_expiring: "Window expiring soon",
};
