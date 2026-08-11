"use client";

import { CalendarDays, Clock3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus, ConsultationBooking } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  requested:
    "border-transparent bg-amber-500/10 text-amber-800 dark:text-amber-300",
  confirmed:
    "border-transparent bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  completed: "border-transparent bg-slate-500/10 text-slate-700 dark:text-slate-300",
  cancelled: "border-transparent bg-red-500/10 text-red-700 dark:text-red-300",
};

function formatDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${isoDate}T00:00:00`));
  } catch {
    return isoDate;
  }
}

interface AppointmentListProps {
  appointments: ConsultationBooking[];
}

export function AppointmentList({ appointments }: AppointmentListProps) {
  if (appointments.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-black/[0.08] bg-white/30 py-20 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]">
          <CalendarDays className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <p className="text-sm font-semibold">No appointments yet</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          Book a consultation from Top Lawyers — your schedule will appear here instantly.
        </p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = appointments.filter((a) => a.date >= today);
  const past = appointments.filter((a) => a.date < today);

  return (
    <div className="space-y-8">
      <Section title="Upcoming" items={upcoming} />
      <Section title="Past" items={past} />
    </div>
  );
}

function Section({ title, items }: { title: string; items: ConsultationBooking[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((apt, i) => (
          <li
            key={apt.id}
            style={{ animationDelay: `${i * 50}ms` }}
            className={cn(
              "mp-card-enter rounded-2xl border border-black/[0.06] bg-white/60 p-4 backdrop-blur-xl",
              "transition-all duration-300 hover:border-slate-300/50 hover:shadow-[0_10px_30px_rgba(15,23,42,0.06)]",
              "dark:border-white/[0.08] dark:bg-white/[0.04]",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold tracking-tight">{apt.lawyer_name}</p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatDate(apt.date)} · {apt.time_slot}
                </p>
              </div>
              <Badge className={cn("capitalize", STATUS_STYLES[apt.status])}>{apt.status}</Badge>
            </div>
            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {apt.matter_summary}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
