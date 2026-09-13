"use client";

import Link from "next/link";

import {
  buildRecentEntries,
  RecentActivityList,
} from "@/components/dashboard/recent-activity";
import type { AppointmentRecord } from "@/lib/appointment-types";
import type { ChatConversation } from "@/lib/conversations";
import type { LegalCase, UserDocument } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  const entries = buildRecentEntries({ recent, upcoming, appointments, documents, limit: 3 });

  return (
    <aside
      className={cn(
        "dash-activity-rail dash-card-in mp-surface-card overflow-hidden rounded-[1.35rem]",
        "lg:sticky lg:top-20",
      )}
      style={{ animationDelay: "180ms" }}
      aria-labelledby="activity-heading"
    >
      <div className="flex items-center justify-between border-b border-black/[0.05] px-5 py-4 dark:border-white/[0.08]">
        <div>
          <h2 id="activity-heading" className="text-[15px] font-semibold tracking-tight">
            Recent activity
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">Continue where you left off</p>
        </div>
        <Link
          href="/appointments"
          className="shrink-0 text-[11.5px] font-medium text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          View all
        </Link>
      </div>
      <div className="px-4 pb-2 pt-1">
        <RecentActivityList
          entries={entries}
          ready={ready}
          emptyText="Chats, bookings, documents, and matters will appear here as you use the workspace."
        />
      </div>
    </aside>
  );
}
