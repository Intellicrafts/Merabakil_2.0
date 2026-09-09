"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowUpRight,
  Briefcase,
  FolderOpen,
  MessageSquare,
  Shield,
  Sparkles,
} from "lucide-react";

import { LawyerAvatar } from "@/components/lawyer-marketplace/lawyer-avatar";
import {
  buildRecentEntries,
  RecentActivityList,
} from "@/components/dashboard/recent-activity";
import { Skeleton } from "@/components/ui/skeleton";
import { appointmentClock } from "@/lib/appointment-format";
import type { AppointmentRecord } from "@/lib/appointment-types";
import {
  lastMessagePreview,
  relativeTime,
  type ChatConversation,
} from "@/lib/conversations";
import type { DashboardSnapshot } from "@/hooks/use-dashboard-snapshot";
import type { LegalCase } from "@/lib/types";
import { cn } from "@/lib/utils";

function pickNextAppointment(rows: AppointmentRecord[]): AppointmentRecord | null {
  const live = rows
    .filter((a) => a.status === "live" || a.status === "confirmed" || a.status === "requested")
    .sort((a, b) => {
      const ta = new Date(a.scheduled_at || a.created_at || 0).getTime();
      const tb = new Date(b.scheduled_at || b.created_at || 0).getTime();
      return ta - tb;
    });
  return live[0] ?? null;
}

function appointmentHref(item: AppointmentRecord): string {
  if (item.status === "live" || item.join_state === "joinable") {
    return `/appointments/${item.id}/room`;
  }
  return `/appointments/${item.id}`;
}

export function DashboardHomeFeed({ snapshot }: { snapshot: DashboardSnapshot }) {
  const nextApt = useMemo(() => pickNextAppointment(snapshot.appointments), [snapshot.appointments]);
  const matters = snapshot.upcoming.slice(0, 3);
  return (
    <section className="space-y-3.5 sm:hidden" aria-label="Your workspace">
      {!snapshot.ready ? (
        <div className="space-y-3">
          <Skeleton className="h-[88px] rounded-[1.25rem]" />
          <Skeleton className="h-[120px] rounded-[1.25rem]" />
          <Skeleton className="h-[160px] rounded-[1.25rem]" />
        </div>
      ) : (
        <>
          {nextApt ? <UpcomingConsultCard apt={nextApt} /> : <FindAdvocateCard />}

          <ContinueCard lastCounsel={snapshot.lastCounsel} />

          {matters.length > 0 ? (
            <MattersCard matters={matters} openCount={snapshot.openCount} />
          ) : (
            <CasesTeaser />
          )}

          <RecentActivityCard snapshot={snapshot} />

          <TrustStrip />
        </>
      )}
    </section>
  );
}

function UpcomingConsultCard({ apt }: { apt: AppointmentRecord }) {
  const name = apt.counterpart_name || apt.lawyer_name || "Consultation";
  const live = apt.status === "live" || apt.join_state === "joinable";

  return (
    <Link
      href={appointmentHref(apt)}
      className={cn(
        "dash-card-in mp-surface-card block overflow-hidden rounded-[1.25rem] p-4",
        "active:scale-[0.99]",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Next consultation
        </p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground",
            "bg-black/[0.04] dark:bg-white/[0.06]",
          )}
        >
          {live ? "Join now" : apt.status.replace("_", " ")}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <LawyerAvatar
          name={name}
          lawyer={{ id: apt.lawyer_id, slug: apt.lawyer_slug, full_name: name }}
          className="h-12 w-12"
          rounded="2xl"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-tight">{name}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {appointmentClock(apt.scheduled_at)}
            {apt.time_slot ? ` · ${apt.time_slot}` : ""}
          </p>
        </div>
        <span className="mp-btn-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function FindAdvocateCard() {
  return (
    <Link
      href="/lawyer-marketplace"
      className={cn(
        "dash-card-in mp-surface-card relative block overflow-hidden rounded-[1.25rem] p-4",
        "active:scale-[0.99]",
      )}
      style={{ animationDelay: "40ms" }}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-black/[0.03] blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] text-foreground/80 dark:bg-white/[0.08]">
          <Briefcase className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight">Book an advocate</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            Match with verified counsel and schedule a consultation.
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}

function ContinueCard({ lastCounsel }: { lastCounsel: ChatConversation | null }) {
  if (!lastCounsel) {
    return (
      <Link
        href="/mera-vakil"
        className={cn(
          "dash-card-in mp-surface-card flex items-center gap-3 rounded-[1.25rem] p-4",
          "active:scale-[0.99]",
        )}
        style={{ animationDelay: "80ms" }}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] text-foreground/80 dark:bg-white/[0.08]">
          <Sparkles className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold tracking-tight">Ask Saarthi</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Cited legal answers in seconds.</p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  return (
    <Link
      href={`/mera-vakil?c=${lastCounsel.id}`}
      className={cn(
        "dash-card-in mp-surface-card flex items-center gap-3 rounded-[1.25rem] p-4",
        "active:scale-[0.99]",
      )}
      style={{ animationDelay: "80ms" }}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] text-foreground/80 dark:bg-white/[0.08]">
        <MessageSquare className="h-5 w-5" strokeWidth={1.7} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-muted-foreground">Continue last chat</p>
        <p className="mt-0.5 truncate text-[14px] font-semibold tracking-tight">{lastCounsel.title}</p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {lastMessagePreview(lastCounsel)} · {relativeTime(lastCounsel.updatedAt)}
        </p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function MattersCard({ matters, openCount }: { matters: LegalCase[]; openCount: number }) {
  return (
    <div
      className={cn(
        "dash-card-in mp-surface-card overflow-hidden rounded-[1.25rem]",
      )}
      style={{ animationDelay: "120ms" }}
    >
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h2 className="text-[14px] font-semibold tracking-tight">Open matters</h2>
        <Link href="/cases" className="text-[12px] font-medium text-muted-foreground">
          {openCount} open
        </Link>
      </div>
      <ul>
        {matters.map((matter) => (
          <li key={matter.id}>
            <Link
              href={`/cases/${matter.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-black/[0.03] dark:active:bg-white/[0.04]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-white/[0.06]">
                <FolderOpen className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{matter.title}</span>
                <span className="block truncate text-[12px] text-muted-foreground">
                  {matter.case_number || "Matter"} · {matter.status.replace("_", " ")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecentActivityCard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const entries = buildRecentEntries({
    recent: snapshot.recent,
    upcoming: snapshot.upcoming,
    appointments: snapshot.appointments,
    documents: snapshot.documents,
    limit: 5,
  });

  return (
    <div
      className={cn(
        "dash-card-in mp-surface-card overflow-hidden rounded-[1.25rem]",
      )}
      style={{ animationDelay: "160ms" }}
    >
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h2 className="text-[14px] font-semibold tracking-tight">Recent activity</h2>
        <Link href="/mera-vakil" className="text-[12px] font-medium text-muted-foreground">
          View all
        </Link>
      </div>
      <div className="px-4 pb-2">
        <RecentActivityList
          entries={entries}
          ready={snapshot.ready}
          emptyText="Your latest chats, bookings, and matters will show up here."
        />
      </div>
    </div>
  );
}

function CasesTeaser() {
  return (
    <Link
      href="/cases"
      className={cn(
        "dash-card-in mp-surface-card flex items-center gap-3 rounded-[1.25rem] border-dashed p-4",
        "active:scale-[0.99]",
      )}
      style={{ animationDelay: "120ms" }}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-white/[0.06]">
        <FolderOpen className="h-5 w-5 text-muted-foreground" strokeWidth={1.7} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold tracking-tight">No open matters</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">Start a case file when you are ready to track one.</p>
      </div>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function TrustStrip() {
  return (
    <p className="flex items-center justify-center gap-1.5 px-2 pb-1 pt-1 text-[11px] text-muted-foreground/70">
      <Shield className="h-3 w-3" strokeWidth={1.75} />
      Private · Cited answers · Verified advocates
    </p>
  );
}
