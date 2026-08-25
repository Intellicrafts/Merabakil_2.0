"use client";

import Link from "next/link";
import { Calendar, CheckCircle2, Clock, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

interface AppointmentCardProps {
  appointment: {
    id?: string;
    lawyer_name?: string;
    date?: string;
    time_slot?: string;
    status?: string;
    matter_summary?: string;
  };
  /** "chat" renders a surface card; "voice" renders dark-glass for the voice overlay */
  variant?: "chat" | "voice";
}

function statusLabel(status: string | undefined): { label: string; confirmed: boolean } {
  if (status === "confirmed") return { label: "Confirmed", confirmed: true };
  return { label: "Requested — awaiting confirmation", confirmed: false };
}

export function AppointmentConfirmationCard({
  appointment,
  variant = "chat",
}: AppointmentCardProps) {
  const { label, confirmed } = statusLabel(appointment.status);
  const isVoice = variant === "voice";

  return (
    <div
      className={cn(
        "rounded-2xl p-4",
        isVoice
          ? "bg-white/[0.07] ring-1 ring-white/[0.12]"
          : "border border-black/[0.06] bg-emerald-50/60 dark:border-white/10 dark:bg-emerald-950/20",
      )}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2
          className={cn(
            "h-4 w-4 shrink-0",
            confirmed ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500",
            isVoice && "text-emerald-400",
          )}
        />
        <p
          className={cn(
            "text-[12px] font-semibold",
            isVoice ? "text-white/80" : "text-emerald-700 dark:text-emerald-400",
          )}
        >
          Consultation {confirmed ? "confirmed" : "requested"}
        </p>
      </div>

      {/* Lawyer name */}
      <p
        className={cn(
          "text-[14px] font-semibold leading-tight",
          isVoice ? "text-white/90" : "text-foreground",
        )}
      >
        {appointment.lawyer_name ?? "Advocate"}
      </p>

      {/* Date + time */}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {appointment.date && (
          <span
            className={cn(
              "flex items-center gap-1 text-[12px]",
              isVoice ? "text-white/55" : "text-muted-foreground",
            )}
          >
            <Calendar className="h-3 w-3" />
            {appointment.date}
          </span>
        )}
        {appointment.time_slot && (
          <span
            className={cn(
              "flex items-center gap-1 text-[12px]",
              isVoice ? "text-white/55" : "text-muted-foreground",
            )}
          >
            <Clock className="h-3 w-3" />
            {appointment.time_slot}
          </span>
        )}
      </div>

      {/* Status pill */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
            confirmed
              ? isVoice
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              : isVoice
                ? "bg-amber-500/20 text-amber-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
          )}
        >
          {label}
        </span>

        {appointment.id && !isVoice && (
          <Link
            href="/appointments"
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            View <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
