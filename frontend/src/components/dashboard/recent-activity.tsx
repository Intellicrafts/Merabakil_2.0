"use client";

import { useRouter } from "next/navigation";
import { CalendarClock, FileText, FolderOpen, MessageSquare, Sparkles } from "lucide-react";

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
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";

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

const KIND_ICON_BG: Record<RecentKind, string> = {
  chat:        "bg-violet-100/70 dark:bg-violet-500/[0.15]",
  appointment: "bg-sky-100/70 dark:bg-sky-500/[0.15]",
  document:    "bg-amber-100/70 dark:bg-amber-500/[0.12]",
  matter:      "bg-emerald-100/70 dark:bg-emerald-500/[0.12]",
};

const KIND_ICON_COLOR: Record<RecentKind, string> = {
  chat:        "text-violet-600 dark:text-violet-400",
  appointment: "text-sky-600 dark:text-sky-400",
  document:    "text-amber-600 dark:text-amber-500",
  matter:      "text-emerald-600 dark:text-emerald-500",
};

const APT_BADGE: Partial<Record<AppointmentStatus, string>> = {
  live:      "Live",
  requested: "Requested",
  confirmed: "Upcoming",
  completed: "Done",
  cancelled: "Cancelled",
  expired:   "Ended",
  no_show:   "Missed",
};

// badge value → Tailwind pill classes
const BADGE_STYLE: Record<string, string> = {
  "Live":         "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  "Upcoming":     "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
  "Requested":    "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
  "Preparing":    "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  "Needs review": "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  "Ready":        "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  "In progress":  "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
  "Open":         "bg-slate-100 text-slate-600 dark:bg-white/[0.07] dark:text-slate-400",
  "Done":         "bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-500",
};

function BadgePill({ label }: { label: string }) {
  const cls = BADGE_STYLE[label] ?? "bg-slate-100 text-slate-500 dark:bg-white/[0.07] dark:text-slate-400";
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[10px] font-semibold leading-[1.4]", cls)}>
      {label}
    </span>
  );
}

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
  limit = 3,
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

  return [...chats, ...apts]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, limit);
}

function KindIcon({ kind }: { kind: RecentKind }) {
  const Icon =
    kind === "chat"
      ? MessageSquare
      : kind === "appointment"
        ? CalendarClock
        : kind === "document"
          ? FileText
          : FolderOpen;
  return <Icon className={cn("h-[15px] w-[15px]", KIND_ICON_COLOR[kind])} strokeWidth={1.75} />;
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
      <div className="space-y-2 px-1 pb-1 pt-1">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
        <Sparkles className="h-6 w-6 text-muted-foreground/20" strokeWidth={1.5} />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground/60">{emptyText}</p>
      </div>
    );
  }

  return (
    <ul {...CLARITY_MASK} className="space-y-0.5">
      {entries.map((entry) => (
        <li key={`${entry.kind}-${entry.id}`}>
          <button
            type="button"
            onClick={() => router.push(entry.href)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left",
              "transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15",
            )}
          >
            {/* Tinted icon circle */}
            <span className={cn(
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              KIND_ICON_BG[entry.kind],
            )}>
              <KindIcon kind={entry.kind} />
            </span>

            {/* Text content */}
            <span className="min-w-0 flex-1">
              {/* Row 1: title + badge + timestamp */}
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium leading-snug tracking-tight">
                    {entry.title}
                  </span>
                  {entry.badge && <BadgePill label={entry.badge} />}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/75">
                  {whenLabel(entry.updatedAt)}
                </span>
              </span>
              {/* Row 2: kind label + subtitle */}
              <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground/65">
                {KIND_LABEL[entry.kind]}
                {entry.subtitle ? ` · ${entry.subtitle}` : ""}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
