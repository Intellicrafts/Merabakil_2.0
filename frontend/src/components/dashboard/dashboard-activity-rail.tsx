"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, FolderOpen, MessageSquare } from "lucide-react";

import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  lastMessagePreview,
  relativeTime,
  saveActiveConversationId,
  type ChatConversation,
} from "@/lib/conversations";
import type { LegalCase } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DashboardActivityRail({
  recent,
  upcoming,
  ready,
}: {
  recent: ChatConversation[];
  upcoming: LegalCase[];
  ready: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  function openCounsel(id: string) {
    saveActiveConversationId(id);
    router.push("/mera-vakil");
  }

  return (
    <aside
      className={cn(
        "dash-activity-rail dash-card-in overflow-hidden rounded-3xl border border-black/[0.07] bg-white/55 backdrop-blur-xl",
        "shadow-[0_4px_20px_rgba(15,23,42,0.03)]",
        "dark:border-white/[0.10] dark:bg-white/[0.035]",
        "lg:sticky lg:top-20",
      )}
      style={{ animationDelay: "180ms" }}
      aria-labelledby="activity-heading"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left md:pointer-events-none"
        aria-expanded={expanded}
        aria-controls="activity-body"
        onClick={() => setExpanded((v) => !v)}
      >
        <h2
          id="activity-heading"
          className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          Activity
        </h2>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform md:hidden",
            expanded && "rotate-180",
          )}
        />
      </button>

      <div id="activity-body" className={cn("space-y-6 px-5 pb-5", expanded ? "block" : "hidden md:block")}>
        <section aria-labelledby="recent-counsel-heading">
          <h3
            id="recent-counsel-heading"
            className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80"
          >
            Recent counsel
          </h3>
          {!ready ? (
            <div className="space-y-2">
              <Skeleton className="h-14 rounded-2xl" />
              <Skeleton className="h-14 rounded-2xl" />
            </div>
          ) : recent.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-black/[0.07] px-3 py-4 text-[12px] leading-relaxed text-muted-foreground dark:border-white/[0.10]">
              No counsel sessions yet. Ask Mera Vakil to start a brief.
            </p>
          ) : (
            <ul className="space-y-1">
              {recent.map((conv) => (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => openCounsel(conv.id)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-2xl px-2.5 py-2 text-left",
                      "transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35",
                    )}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.06]">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[13px] font-medium tracking-tight">{conv.title}</span>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
                          {relativeTime(conv.updatedAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-[11px] text-muted-foreground">
                        {lastMessagePreview(conv)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="docket-heading">
          <h3
            id="docket-heading"
            className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80"
          >
            Docket
          </h3>
          {!ready ? (
            <div className="space-y-2">
              <Skeleton className="h-12 rounded-2xl" />
            </div>
          ) : upcoming.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-black/[0.07] px-3 py-4 text-[12px] leading-relaxed text-muted-foreground dark:border-white/[0.10]">
              No open matters on the docket.
            </p>
          ) : (
            <ul className="space-y-1">
              {upcoming.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/cases/${item.id}`)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-2xl px-2.5 py-2 text-left",
                      "transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35",
                    )}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black/[0.06] bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.06]">
                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium tracking-tight">{item.title}</span>
                        <CaseStatusBadge status={item.status} />
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-[11px] text-muted-foreground">
                        {item.case_number} · {relativeTime(item.updated_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
