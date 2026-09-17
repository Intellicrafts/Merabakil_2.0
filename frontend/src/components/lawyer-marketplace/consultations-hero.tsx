"use client";

import { BadgeCheck, CalendarClock, Radio } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import type { AppointmentRecord } from "@/lib/appointment-types";
import { liveJoinPhase } from "@/lib/appointment-format";
import { cn } from "@/lib/utils";

interface ConsultationsHeroProps {
  appointments: AppointmentRecord[];
  now?: number;
  embedded?: boolean;
}

export function ConsultationsHero({ appointments, now = Date.now(), embedded }: ConsultationsHeroProps) {
  const { t } = useTranslation();

  const upcoming = appointments.filter(
    (a) => liveJoinPhase(a, now) !== "expired" && !["cancelled", "expired", "no_show", "completed"].includes(a.status),
  ).length;
  const live = appointments.filter(
    (a) => a.status === "live" || liveJoinPhase(a, now) === "joinable",
  ).length;
  const completed = appointments.filter((a) => a.status === "completed").length;

  if (embedded) {
    return (
      <div className="grid grid-cols-3 gap-2">
        <MobileStat icon={CalendarClock} label="Upcoming" value={upcoming} />
        <MobileStat icon={Radio} label="Live" value={live} />
        <MobileStat icon={BadgeCheck} label="Done" value={completed} />
      </div>
    );
  }

  return (
    <header className={cn("mp-card-enter space-y-3 sm:space-y-4")}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:block">
            Consultations
          </p>
          <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-[1.75rem]">
            {t("appointments.myConsultations")}
          </h1>
          <p className="hidden max-w-lg text-[14px] leading-relaxed text-muted-foreground sm:block">
            {t("appointments.upcomingAndPast")}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <StatChip icon={CalendarClock} label="Upcoming" value={upcoming} />
          <StatChip icon={Radio} label="Live" value={live} />
          <StatChip icon={BadgeCheck} label="Done" value={completed} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <MobileStat icon={CalendarClock} label="Upcoming" value={upcoming} />
        <MobileStat icon={Radio} label="Live" value={live} />
        <MobileStat icon={BadgeCheck} label="Done" value={completed} />
      </div>

      <div className="hidden h-px bg-black/[0.05] dark:bg-white/[0.06] sm:block" />
    </header>
  );
}

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(28_14%_64%)] bg-white px-3 py-1.5 text-[12px] shadow-[0_4px_12px_rgba(42,28,12,0.05)] dark:border-white/[0.08] dark:bg-white/[0.04]">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function MobileStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: number;
}) {
  return (
    <div className="mp-surface-card flex flex-col items-center rounded-2xl px-2 py-2.5 text-center">
      <Icon className="mb-1 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
      <p className="text-[15px] font-semibold tabular-nums tracking-tight">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  );
}
