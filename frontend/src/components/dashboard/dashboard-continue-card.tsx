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
    return <Skeleton className="h-[88px] w-full rounded-3xl" />;
  }

  if (!lastCounsel) {
    return (
      <Link
        href="/mera-vakil"
        className={cn(
          "dash-card-in group flex items-center justify-between gap-4 rounded-3xl border border-dashed border-black/[0.08] bg-white/40 px-5 py-4",
          "transition-colors hover:border-black/[0.12] hover:bg-white/70",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35 focus-visible:ring-offset-2",
          "dark:border-white/[0.10] dark:bg-white/[0.02] dark:hover:border-white/[0.16]",
        )}
        style={{ animationDelay: "80ms" }}
      >
        <div>
          <p className="text-[13px] font-semibold tracking-tight">Start your first counsel session</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Ask a legal question with grounded citations.
          </p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/[0.06] text-muted-foreground transition-colors group-hover:bg-slate-900 group-hover:text-white dark:border-white/[0.08] dark:group-hover:bg-white dark:group-hover:text-slate-900">
          <ArrowUpRight className="h-3.5 w-3.5" />
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
        "dash-card-in group flex w-full items-center justify-between gap-4 rounded-3xl border border-black/[0.07] bg-white/65 px-5 py-4 text-left shadow-[0_4px_20px_rgba(15,23,42,0.04)] backdrop-blur-xl",
        "transition-all duration-200 hover:-translate-y-px hover:border-black/[0.11] hover:bg-white/85",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/35 focus-visible:ring-offset-2",
        "dark:border-white/[0.10] dark:bg-white/[0.04] dark:hover:border-white/[0.16]",
      )}
      style={{ animationDelay: "80ms" }}
    >
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Sparkles className="h-3 w-3" strokeWidth={1.75} />
            Continue last matter
          </span>
          {matter && (
            <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground dark:bg-white/[0.06]">
              {matter.label}
            </span>
          )}
          <span className="text-[11px] tabular-nums text-muted-foreground/70">
            {relativeTime(lastCounsel.updatedAt)}
          </span>
        </div>
        <p className="truncate text-[14px] font-semibold tracking-tight">{lastCounsel.title}</p>
        <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
          {lastMessagePreview(lastCounsel)}
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white transition-transform duration-150 group-hover:translate-x-px dark:bg-white dark:text-slate-900">
        Resume
        <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}
