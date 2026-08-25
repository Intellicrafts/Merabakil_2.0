"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { CalendarClock, FileText, FolderOpen, MessageSquare } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { AppointmentRecord } from "@/lib/appointment-types";
import {
  lastMessagePreview,
  relativeTime,
  saveActiveConversationId,
  type ChatConversation,
} from "@/lib/conversations";
import { formatDocStatus } from "@/lib/demo-documents";
import type { AppointmentStatus, LegalCase, UserDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

type RecentKind = "chat" | "appointment" | "document" | "matter";

interface RecentEntry {
  kind: RecentKind;
  id: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  href: string;
  conversationId?: string;
  badge?: string;
  badgeTone?: "live" | "prep" | "open" | "done" | "muted";
}

const KIND_LABEL: Record<RecentKind, string> = {
  chat: "Conversation",
  appointment: "Appointment",
  document: "Document",
  matter: "Matter",
};

const BADGE_CLASS: Record<NonNullable<RecentEntry["badgeTone"]>, string> = {
  live: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
  prep: "bg-amber-500/12 text-amber-800 dark:text-amber-300",
  open: "bg-sky-500/12 text-sky-800 dark:text-sky-300",
  done: "bg-black/[0.05] text-muted-foreground dark:bg-white/[0.08]",
  muted: "bg-black/[0.04] text-muted-foreground dark:bg-white/[0.06]",
};

const APT_BADGE: Partial<Record<AppointmentStatus, { label: string; tone: NonNullable<RecentEntry["badgeTone"]> }>> = {
  live: { label: "Live", tone: "live" },
  requested: { label: "Awaiting", tone: "prep" },
  confirmed: { label: "Upcoming", tone: "open" },
  completed: { label: "Completed", tone: "done" },
  cancelled: { label: "Cancelled", tone: "muted" },
  expired: { label: "Ended", tone: "muted" },
  no_show: { label: "Missed", tone: "muted" },
};

function whenLabel(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  if (t > Date.now()) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(t));
  }
  return relativeTime(iso);
}

function appointmentHref(item: AppointmentRecord): string {
  if (item.status === "live" || item.join_state === "joinable") {
    return `/appointments/${item.id}/room`;
  }
  return `/appointments/${item.id}`;
}

function appointmentStamp(item: AppointmentRecord): string {
  return item.scheduled_at || item.created_at || "";
}

function pickAppointments(rows: AppointmentRecord[]): AppointmentRecord[] {
  const active = rows.filter((a) => a.status === "live" || a.status === "confirmed" || a.status === "requested");
  const completed = [...rows]
    .filter((a) => a.status === "completed")
    .sort((a, b) => new Date(appointmentStamp(b)).getTime() - new Date(appointmentStamp(a)).getTime());
  const merged = [...active];
  if (completed[0] && !merged.some((a) => a.id === completed[0].id)) {
    merged.push(completed[0]);
  }
  return merged
    .sort((a, b) => new Date(appointmentStamp(b)).getTime() - new Date(appointmentStamp(a)).getTime())
    .slice(0, 3);
}

function isPreparingDoc(status: string): boolean {
  return /pending|processing|upload|prepar|draft|queued/i.test(status);
}

function pickDocuments(rows: UserDocument[]): UserDocument[] {
  const preparing = rows.filter((d) => isPreparingDoc(d.status) || /fail/i.test(d.status));
  const rest = rows.filter((d) => !preparing.includes(d));
  return [...preparing, ...rest]
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at || 0).getTime() -
        new Date(a.updated_at || a.created_at || 0).getTime(),
    )
    .slice(0, 3);
}

function documentBadge(status: string): { label: string; tone: NonNullable<RecentEntry["badgeTone"]> } {
  if (isPreparingDoc(status)) return { label: "Preparing", tone: "prep" };
  if (/fail/i.test(status)) return { label: "Needs attention", tone: "prep" };
  if (/index|ready|complete/i.test(status)) return { label: "Ready", tone: "done" };
  return { label: formatDocStatus(status), tone: "muted" };
}

export function DashboardActivityRail({
  recent,
  upcoming,
  appointments,
  documents,
  ready,
}: {
  recent: ChatConversation[];
  upcoming: LegalCase[];
  appointments: AppointmentRecord[];
  documents: UserDocument[];
  ready: boolean;
}) {
  const router = useRouter();

  const entries = useMemo<RecentEntry[]>(() => {
    const chats: RecentEntry[] = recent.slice(0, 4).map((conv) => ({
      kind: "chat",
      id: conv.id,
      title: conv.title,
      subtitle: lastMessagePreview(conv),
      updatedAt: conv.updatedAt,
      href: `/mera-vakil?c=${conv.id}`,
      conversationId: conv.id,
    }));

    const matters: RecentEntry[] = upcoming.map((item) => ({
      kind: "matter",
      id: item.id,
      title: item.title,
      subtitle: item.case_number,
      updatedAt: item.updated_at,
      href: `/cases/${item.id}`,
      badge: item.status === "in_progress" ? "In progress" : "Open",
      badgeTone: item.status === "in_progress" ? "prep" : "open",
    }));

    const apts: RecentEntry[] = pickAppointments(appointments).map((item) => {
      const meta = APT_BADGE[item.status];
      return {
        kind: "appointment" as const,
        id: item.id,
        title: item.counterpart_name || item.lawyer_name || "Consultation",
        subtitle: item.matter_summary || "Legal consultation",
        updatedAt: appointmentStamp(item),
        href: appointmentHref(item),
        badge: meta?.label,
        badgeTone: meta?.tone,
      };
    });

    const docs: RecentEntry[] = pickDocuments(documents).map((item) => {
      const meta = documentBadge(item.status);
      return {
        kind: "document" as const,
        id: item.document_id,
        title: item.title || item.filename || "Document",
        subtitle: item.doc_type ? formatDocStatus(item.doc_type) : "Your file",
        updatedAt: item.updated_at || item.created_at || "",
        href: `/documents/${item.document_id}`,
        badge: meta.label,
        badgeTone: meta.tone,
      };
    });

    return [...chats, ...apts, ...docs, ...matters]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);
  }, [recent, upcoming, appointments, documents]);

  function openEntry(entry: RecentEntry) {
    if (entry.conversationId) {
      saveActiveConversationId(entry.conversationId);
    }
    router.push(entry.href);
  }

  return (
    <aside
      className={cn(
        "dash-activity-rail dash-card-in overflow-hidden rounded-3xl border border-black/[0.06] bg-white/80 backdrop-blur-xl",
        "shadow-[0_8px_28px_rgba(15,23,42,0.045)]",
        "dark:border-white/[0.10] dark:bg-white/[0.035]",
        "lg:sticky lg:top-20",
      )}
      style={{ animationDelay: "180ms" }}
      aria-labelledby="activity-heading"
    >
      <div className="flex items-end justify-between gap-3 px-5 pb-3 pt-5">
        <div>
          <h2 id="activity-heading" className="text-[15px] font-semibold tracking-tight">
            Recent
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Pick up anything in progress</p>
        </div>
      </div>

      <div className="px-2 pb-3">
        {!ready ? (
          <div className="space-y-2 px-3 pb-2">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : entries.length === 0 ? (
          <p className="mx-3 mb-3 rounded-2xl border border-dashed border-black/[0.07] px-4 py-5 text-[13px] leading-relaxed text-muted-foreground dark:border-white/[0.10]">
            When you chat, book a consultation, prepare a document, or open a matter, it will appear here.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {entries.map((entry) => {
              const Icon =
                entry.kind === "chat"
                  ? MessageSquare
                  : entry.kind === "appointment"
                    ? CalendarClock
                    : entry.kind === "document"
                      ? FileText
                      : FolderOpen;
              return (
                <li key={`${entry.kind}-${entry.id}`}>
                  <button
                    type="button"
                    onClick={() => openEntry(entry)}
                    className={cn(
                      "flex min-h-14 w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left",
                      "transition-colors hover:bg-black/[0.03] active:scale-[0.99] dark:hover:bg-white/[0.05]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
                    )}
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-white/[0.06]">
                      <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-medium tracking-tight">{entry.title}</span>
                          <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                            {KIND_LABEL[entry.kind]}
                            {entry.subtitle ? ` · ${entry.subtitle}` : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {entry.badge ? (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                BADGE_CLASS[entry.badgeTone ?? "muted"],
                              )}
                            >
                              {entry.badge}
                            </span>
                          ) : null}
                          <span className="text-[11px] tabular-nums text-muted-foreground/70">
                            {whenLabel(entry.updatedAt)}
                          </span>
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
