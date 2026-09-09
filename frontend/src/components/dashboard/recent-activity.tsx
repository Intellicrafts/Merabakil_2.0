"use client";

import { useRouter } from "next/navigation";
import { CalendarClock, FileText, FolderOpen, MessageSquare } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import type { AppointmentRecord } from "@/lib/appointment-types";
import {
  lastMessagePreview,
  relativeTime,
  type ChatConversation,
} from "@/lib/conversations";
import { formatDocStatus } from "@/lib/demo-documents";
import type { AppointmentStatus, LegalCase, UserDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

export type RecentKind = "chat" | "appointment" | "document" | "matter";

export interface RecentEntry {
  kind: RecentKind;
  id: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  href: string;
  badge?: string;
}

const KIND_LABEL: Record<RecentKind, string> = {
  chat: "Conversation",
  appointment: "Consultation",
  document: "Document",
  matter: "Matter",
};

const APT_BADGE: Partial<Record<AppointmentStatus, string>> = {
  live: "Live",
  requested: "Requested",
  confirmed: "Upcoming",
  completed: "Done",
  cancelled: "Cancelled",
  expired: "Ended",
  no_show: "Missed",
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

function documentBadge(status: string): string {
  if (isPreparingDoc(status)) return "Preparing";
  if (/fail/i.test(status)) return "Needs review";
  if (/index|ready|complete/i.test(status)) return "Ready";
  return formatDocStatus(status);
}

export function buildRecentEntries({
  recent,
  upcoming,
  appointments,
  documents,
  limit = 8,
}: {
  recent: ChatConversation[];
  upcoming: LegalCase[];
  appointments: AppointmentRecord[];
  documents: UserDocument[];
  limit?: number;
}): RecentEntry[] {
  const chats: RecentEntry[] = recent.slice(0, 4).map((conv) => ({
    kind: "chat",
    id: conv.id,
    title: conv.title,
    subtitle: lastMessagePreview(conv),
    updatedAt: conv.updatedAt,
    href: `/mera-vakil?c=${conv.id}`,
  }));

  const matters: RecentEntry[] = upcoming.map((item) => ({
    kind: "matter",
    id: item.id,
    title: item.title,
    subtitle: item.case_number || "Open matter",
    updatedAt: item.updated_at,
    href: `/cases/${item.id}`,
    badge: item.status === "in_progress" ? "In progress" : "Open",
  }));

  const apts: RecentEntry[] = pickAppointments(appointments).map((item) => ({
    kind: "appointment" as const,
    id: item.id,
    title: item.counterpart_name || item.lawyer_name || "Consultation",
    subtitle: item.matter_summary || "Legal consultation",
    updatedAt: appointmentStamp(item),
    href: appointmentHref(item),
    badge: APT_BADGE[item.status],
  }));

  const docs: RecentEntry[] = pickDocuments(documents).map((item) => ({
    kind: "document" as const,
    id: item.document_id,
    title: item.title || item.filename || "Document",
    subtitle: item.doc_type ? formatDocStatus(item.doc_type) : "Your file",
    updatedAt: item.updated_at || item.created_at || "",
    href: `/documents/${item.document_id}`,
    badge: documentBadge(item.status),
  }));

  return [...chats, ...apts, ...docs, ...matters]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

function KindIcon({ kind }: { kind: RecentKind }) {
  const Icon =
    kind === "chat" ? MessageSquare : kind === "appointment" ? CalendarClock : kind === "document" ? FileText : FolderOpen;
  return <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.7} />;
}

export function RecentActivityList({
  entries,
  ready,
  emptyText,
}: {
  entries: RecentEntry[];
  ready: boolean;
  emptyText: string;
}) {
  const router = useRouter();

  if (!ready) {
    return (
      <div className="space-y-2 px-1 pb-1">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="px-1 py-3 text-[13px] leading-relaxed text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-0.5">
      {entries.map((entry) => {
        const detail = entry.kind === "chat" ? entry.subtitle : entry.badge || entry.subtitle;
        const meta = [KIND_LABEL[entry.kind], detail].filter(Boolean).join(" · ");
        return (
          <li key={`${entry.kind}-${entry.id}`}>
            <button
              type="button"
              onClick={() => router.push(entry.href)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left",
                "transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15",
              )}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-white/[0.06]">
                <KindIcon kind={entry.kind} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13.5px] font-medium tracking-tight">{entry.title}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                    {whenLabel(entry.updatedAt)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{meta}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
