"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Sparkles } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  MATTER_TYPES,
  lastMessagePreview,
  relativeTime,
  type ChatConversation,
} from "@/lib/conversations";
import { cn } from "@/lib/utils";

export function DashboardContinueCard({
  lastCounsel,
  ready,
}: {
  lastCounsel: ChatConversation | null;
  ready: boolean;
}) {
  const router = useRouter();

  if (!ready) {
    return <Skeleton className="h-[96px] w-full rounded-3xl" />;
  }

  if (!lastCounsel) {
    return (
      <Link
        href="/mera-vakil"
        className={cn(
          "dash-card-in group flex min-h-14 items-center justify-between gap-4 rounded-3xl border border-dashed border-black/[0.08] bg-white/40 px-5 py-4",
          "transition-transform duration-150 hover:border-black/[0.12] hover:bg-white/70 active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2",
          "dark:border-white/[0.10] dark:bg-white/[0.02] dark:hover:border-white/[0.16]",
        )}
        style={{ animationDelay: "80ms" }}
      >
        <div>
          <p className="text-[14px] font-semibold tracking-tight">Start a conversation</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Ask a legal question — we’ll cite the law.
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.06] text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground dark:border-white/[0.08]">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </Link>
    );
  }

  const matter = MATTER_TYPES.find((m) => m.id === lastCounsel.matterType);

  function resume() {
    router.push(`/mera-vakil?c=${lastCounsel!.id}`);
  }

  return (
    <button
      type="button"
      onClick={resume}
      className={cn(
        "dash-card-in group flex w-full min-h-[5.5rem] items-center justify-between gap-3 rounded-3xl border border-black/[0.06] bg-white/75 px-5 py-4 text-left",
        "shadow-[0_8px_28px_rgba(15,23,42,0.05)] backdrop-blur-xl max-sm:flex-col max-sm:items-stretch sm:gap-4",
        "transition-transform duration-200 hover:-translate-y-px hover:border-primary/20 hover:shadow-[0_12px_32px_rgba(15,23,42,0.07)] active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2",
        "dark:border-white/[0.10] dark:bg-white/[0.04] dark:hover:border-primary/30",
      )}
      style={{ animationDelay: "80ms" }}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:bg-primary/15">
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-muted-foreground">Pick up where you left off</span>
            {matter && (
              <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-medium text-muted-foreground dark:bg-white/[0.06]">
                {matter.label}
              </span>
            )}
            <span className="text-[12px] tabular-nums text-muted-foreground/70">
              {relativeTime(lastCounsel.updatedAt)}
            </span>
          </div>
          <p className="truncate text-[15px] font-semibold tracking-tight">{lastCounsel.title}</p>
          <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">
            {lastMessagePreview(lastCounsel)}
          </p>
        </div>
      </div>
      <span className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition-transform duration-150 group-hover:translate-x-px max-sm:w-full">
        Resume
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}
