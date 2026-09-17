"use client";

import {
  BadgeCheck,
  BellRing,
  CheckCircle2,
  Hourglass,
  Radio,
  XCircle,
} from "lucide-react";

import type { AppointmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  AppointmentStatus,
  { icon: typeof Hourglass; label: string; className: string; pulse?: boolean }
> = {
  requested: {
    icon: Hourglass,
    label: "Pending review",
    className:
      "border-amber-500/25 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 dark:border-amber-400/30 dark:from-amber-950/70 dark:to-orange-950/50 dark:text-amber-100",
  },
  confirmed: {
    icon: CheckCircle2,
    label: "Confirmed",
    className:
      "border-emerald-500/25 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-800 dark:border-emerald-400/30 dark:from-emerald-950/80 dark:to-teal-950/60 dark:text-emerald-200",
  },
  live: {
    icon: Radio,
    label: "Live",
    className:
      "border-sky-500/30 bg-gradient-to-r from-sky-50 to-cyan-50 text-sky-900 dark:border-sky-400/35 dark:from-sky-950/70 dark:to-cyan-950/50 dark:text-sky-100",
    pulse: true,
  },
  completed: {
    icon: BadgeCheck,
    label: "Completed",
    className:
      "border-black/[0.08] bg-black/[0.04] text-foreground/70 dark:border-white/[0.12] dark:bg-white/[0.08] dark:text-zinc-200",
  },
  expired: {
    icon: XCircle,
    label: "Expired",
    className:
      "border-black/[0.08] bg-black/[0.04] text-muted-foreground dark:border-white/[0.10] dark:bg-white/[0.06]",
  },
  cancelled: {
    icon: XCircle,
    label: "Cancelled",
    className:
      "border-black/[0.08] bg-black/[0.04] text-muted-foreground dark:border-white/[0.10] dark:bg-white/[0.06]",
  },
  no_show: {
    icon: XCircle,
    label: "No show",
    className:
      "border-black/[0.08] bg-black/[0.04] text-muted-foreground dark:border-white/[0.10] dark:bg-white/[0.06]",
  },
};

interface AppointmentStatusBadgeProps {
  status: AppointmentStatus;
  className?: string;
}

export function AppointmentStatusBadge({ status, className }: AppointmentStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.confirmed;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-[0_1px_3px_rgba(15,23,42,0.06)]",
        config.className,
        config.pulse && "mp-pulse-dot",
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2.25} />
      <span className="capitalize">{config.label}</span>
    </span>
  );
}

export function JoinRequestBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-violet-500/25 bg-gradient-to-r from-violet-50 to-purple-50 px-2 py-0.5 text-[10px] font-semibold text-violet-900 shadow-[0_1px_3px_rgba(15,23,42,0.06)] dark:border-violet-400/30 dark:from-violet-950/70 dark:to-purple-950/50 dark:text-violet-100",
        className,
      )}
    >
      <BellRing className="h-3 w-3 shrink-0" strokeWidth={2.25} />
      Join request
    </span>
  );
}
