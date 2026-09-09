"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarClock, Check, Clock3, X } from "lucide-react";

import { LawyerAvatar } from "@/components/lawyer-marketplace/lawyer-avatar";
import type { VoiceBookedAppointment } from "@/hooks/use-voice-bot";
import { cn } from "@/lib/utils";

function formatBookingDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function statusCopy(status: string | undefined): { label: string; confirmed: boolean } {
  if (status === "confirmed") return { label: "Confirmed", confirmed: true };
  if (status === "requested") return { label: "Awaiting counsel", confirmed: false };
  return { label: "Booking recorded", confirmed: false };
}

export function VoiceBookingConfirmationModal({
  appointment,
  onDismiss,
}: {
  appointment: VoiceBookedAppointment;
  onDismiss: () => void;
}) {
  const { label, confirmed } = statusCopy(appointment.status);
  const lawyerName = appointment.lawyer_name || "Advocate";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center p-4 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-booking-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[6px]"
        onClick={onDismiss}
        aria-label="Close booking confirmation"
      />

      <div
        className={cn(
          "relative w-full max-w-[22rem] overflow-hidden rounded-[1.35rem] sm:max-w-md",
          "border border-[hsl(28_14%_76%)] bg-white",
          "shadow-[0_24px_64px_rgba(0,0,0,0.45)]",
          "animate-in fade-in slide-in-from-bottom-4 duration-300 sm:slide-in-from-bottom-0 sm:zoom-in-95",
        )}
      >
        <div className="relative border-b border-black/[0.06] px-5 pb-4 pt-5">
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close"
            className={cn(
              "absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-full",
              "text-muted-foreground transition-colors",
              "hover:bg-black/[0.04] hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15",
            )}
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                confirmed ? "bg-black/[0.05] text-foreground/80" : "bg-black/[0.04] text-muted-foreground",
              )}
            >
              <Check className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Consultation booked
              </p>
              <h2 id="voice-booking-title" className="mt-1 text-[17px] font-semibold tracking-tight text-foreground">
                {confirmed ? "You're on the calendar" : "Request sent"}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {confirmed
                  ? "Your session is scheduled. Details are saved under My Consultations."
                  : "The advocate will confirm shortly. We'll notify you when it's ready."}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-[hsl(40_18%_97%)] p-3.5">
            <LawyerAvatar name={lawyerName} className="h-12 w-12" rounded="2xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold tracking-tight">{lawyerName}</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Counsel</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium",
                "bg-black/[0.05] text-foreground/70",
              )}
            >
              {label}
            </span>
          </div>

          <div className="grid gap-2.5">
            {appointment.date ? (
              <div className="flex items-center gap-2.5 text-[13px] text-foreground/85">
                <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span>{formatBookingDate(appointment.date)}</span>
              </div>
            ) : null}
            {appointment.time_slot ? (
              <div className="flex items-center gap-2.5 text-[13px] text-foreground/85">
                <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span>{appointment.time_slot}</span>
              </div>
            ) : null}
          </div>

          {appointment.matter_summary ? (
            <div className="rounded-xl border border-black/[0.05] bg-black/[0.02] px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Matter
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/85">
                {appointment.matter_summary}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex gap-2 border-t border-black/[0.06] bg-[hsl(40_18%_97%)] p-4">
          <button
            type="button"
            onClick={onDismiss}
            className="mp-btn-primary h-11 flex-1 rounded-xl text-[13px] font-semibold"
          >
            Continue
          </button>
          {appointment.id ? (
            <Link
              href={`/appointments/${appointment.id}`}
              onClick={onDismiss}
              className="mp-btn-accent inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl text-[13px] font-semibold"
            >
              View
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <Link
              href="/lawyer-marketplace"
              onClick={onDismiss}
              className="mp-btn-accent inline-flex h-11 flex-1 items-center justify-center gap-1 rounded-xl text-[13px] font-semibold"
            >
              Bookings
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
