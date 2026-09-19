"use client";

import { CalendarClock, List, MoreHorizontal, Radio, Siren } from "lucide-react";

import { cn } from "@/lib/utils";

export type AdminOpsTab = "live" | "queue" | "sos" | "more";

interface AdminOpsLayoutProps {
  tab: AdminOpsTab;
  onTabChange: (tab: AdminOpsTab) => void;
  opsLive: boolean;
  emergencyCount: number;
  liveTotal: number;
  children: React.ReactNode;
  moreContent?: React.ReactNode;
}

const TABS: { id: AdminOpsTab; label: string; icon: typeof Radio }[] = [
  { id: "live", label: "Live", icon: Radio },
  { id: "queue", label: "Queue", icon: List },
  { id: "sos", label: "SOS", icon: Siren },
  { id: "more", label: "More", icon: MoreHorizontal },
];

export function AdminOpsLayout({
  tab,
  onTabChange,
  opsLive,
  emergencyCount,
  liveTotal,
  children,
  moreContent,
}: AdminOpsLayoutProps) {
  return (
    <div className="mx-auto max-w-7xl pb-16 md:pb-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CalendarClock className="h-6 w-6 text-primary" />
            Appointment operations
          </h1>
          <p className="text-sm text-muted-foreground">
            Live command center {opsLive ? "· Ops stream live" : "· Reconnecting…"}
            {emergencyCount > 0 ? ` · ${emergencyCount} SOS` : ""}
          </p>
        </div>
        <div className="hidden gap-2 md:flex">
          {TABS.filter((t) => t.id !== "more").map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium transition",
                tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-muted",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              {t.id === "live" && liveTotal > 0 ? (
                <span className="rounded-full bg-emerald-500/20 px-1.5 text-[10px] tabular-nums">{liveTotal}</span>
              ) : null}
              {t.id === "sos" && emergencyCount > 0 ? (
                <span className="rounded-full bg-amber-500/30 px-1.5 text-[10px] tabular-nums">{emergencyCount}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">{tab === "more" ? moreContent : children}</div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-background/95 backdrop-blur-md md:hidden dark:border-white/10">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={cn(
                "flex min-w-[4rem] flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium",
                tab === t.id ? "text-primary" : "text-muted-foreground",
              )}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
              {t.id === "sos" && emergencyCount > 0 ? (
                <span className="absolute mt-0.5 ml-6 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] text-white">
                  {emergencyCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
