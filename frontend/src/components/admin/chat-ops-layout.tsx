"use client";

import { MessageSquare, RefreshCw, Sparkles, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ChatOpsTab = "users" | "conversations";

interface ChatOpsLayoutProps {
  tab: ChatOpsTab;
  onTabChange: (tab: ChatOpsTab) => void;
  stats: {
    usersWithChats: number;
    totalConversations: number;
    totalMessages: number;
    messagesToday: number;
  };
  statsLoading?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
}

const TABS: { id: ChatOpsTab; label: string; icon: typeof Users }[] = [
  { id: "users", label: "By User", icon: Users },
  { id: "conversations", label: "All Conversations", icon: MessageSquare },
];

export function ChatOpsLayout({
  tab,
  onTabChange,
  stats,
  statsLoading,
  onRefresh,
  refreshing,
  children,
}: ChatOpsLayoutProps) {
  return (
    <div className="mx-auto max-w-7xl pb-16 md:pb-10">
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-50 via-white to-indigo-50 px-5 py-5 dark:border-violet-500/20 dark:from-violet-950/40 dark:via-[hsl(220_14%_9%)] dark:to-indigo-950/30 sm:px-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-violet-400/10 blur-2xl dark:bg-violet-500/20" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              <Sparkles className="h-3 w-3" />
              Saarthi Ops
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Chat Operations</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Monitor conversations, review full history grouped by user, and moderate Saarthi chats.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onRefresh ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={refreshing}
                onClick={onRefresh}
                className="rounded-xl border-violet-500/20 bg-white/70 dark:bg-white/[0.04]"
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", refreshing && "animate-spin")} />
                Refresh
              </Button>
            ) : null}
            <div className="hidden gap-2 md:flex">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTabChange(t.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium transition",
                    tab === t.id
                      ? "bg-violet-600 text-white shadow-sm dark:bg-violet-500"
                      : "bg-white/70 text-foreground/70 hover:bg-white dark:bg-white/[0.06] dark:hover:bg-white/[0.1]",
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatChip label="Users with chats" value={stats.usersWithChats} loading={statsLoading} accent="violet" />
          <StatChip label="Conversations" value={stats.totalConversations} loading={statsLoading} accent="indigo" />
          <StatChip label="Total messages" value={stats.totalMessages} loading={statsLoading} accent="sky" />
          <StatChip label="Messages today" value={stats.messagesToday} loading={statsLoading} accent="emerald" />
        </div>
      </div>

      <div className="space-y-5">{children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-background/95 backdrop-blur-md md:hidden dark:border-white/10">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                tab === t.id ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground",
              )}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function StatChip({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: number;
  loading?: boolean;
  accent: "violet" | "indigo" | "sky" | "emerald";
}) {
  const accentClass = {
    violet: "border-violet-500/15 bg-violet-500/[0.06]",
    indigo: "border-indigo-500/15 bg-indigo-500/[0.06]",
    sky: "border-sky-500/15 bg-sky-500/[0.06]",
    emerald: "border-emerald-500/15 bg-emerald-500/[0.06]",
  }[accent];

  return (
    <div className={cn("rounded-2xl border px-3.5 py-3 backdrop-blur-sm", accentClass)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">
        {loading ? "—" : value.toLocaleString()}
      </p>
    </div>
  );
}
