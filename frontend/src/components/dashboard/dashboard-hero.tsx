"use client";

import { Shield } from "lucide-react";

import { getRoleLabel, type DashboardConfig } from "@/lib/dashboard-config";
import { cn } from "@/lib/utils";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

export function DashboardHero({
  firstName,
  config,
}: {
  firstName: string;
  config: DashboardConfig;
}) {
  const stats = [
    { label: "Corpus", value: "1,250+" },
    { label: "Modules", value: String(config.modules.length) },
    { label: "Status", value: "Live" },
  ];

  return (
    <header
      className={cn(
        "relative overflow-hidden border-b border-black/[0.05] dark:border-white/[0.06]",
        "px-5 pb-6 pt-3 sm:rounded-3xl sm:border sm:border-black/[0.06] sm:bg-white/45 sm:px-7 sm:pb-8 sm:pt-7 sm:backdrop-blur-xl",
        "dark:sm:border-white/[0.08] dark:sm:bg-white/[0.03]",
        "dash-card-in",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px dash-shimmer-line hidden sm:block" />
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-slate-400/20 blur-3xl dash-hero-glow dark:bg-slate-300/10" />
      <div className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-slate-500/10 blur-3xl dash-hero-glow dark:bg-white/5" />
      <div className="pointer-events-none absolute right-8 top-4 hidden h-40 w-40 opacity-40 lg:block">
        <div className="aurora h-full w-full" />
      </div>

      <div className="relative space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm dark:border-white/[0.08] dark:bg-white/[0.05]">
            <Shield className="h-3 w-3" strokeWidth={1.75} />
            {getRoleLabel(config.role)}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground/80">{formatDate()}</span>
          <span className="ml-auto hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dash-live-dot" />
            Systems live
          </span>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl space-y-2.5">
            <h1 className="text-[1.85rem] font-semibold leading-[1.12] tracking-tight sm:text-[2.15rem] md:text-[2.35rem]">
              {getGreeting()},{" "}
              <span className="gradient-text">{firstName}</span>
            </h1>
            <p className="max-w-lg text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
              <span className="font-medium text-foreground/90">{config.headline}</span>
              {" — "}
              {config.subtitle}
            </p>
          </div>

          {/* Mobile: pill chips · Desktop: segmented stats */}
          <div className="flex flex-wrap gap-2 sm:hidden">
            {stats.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/60 px-3 py-1.5 text-[11px] dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold tabular-nums">{item.value}</span>
              </span>
            ))}
          </div>

          <dl className="hidden shrink-0 divide-x divide-black/[0.06] overflow-hidden rounded-2xl border border-black/[0.06] bg-white/60 shadow-[0_4px_20px_rgba(15,23,42,0.04)] dark:divide-white/[0.08] dark:border-white/[0.08] dark:bg-white/[0.04] sm:flex">
            {stats.map((item) => (
              <div key={item.label} className="min-w-[88px] px-5 py-3.5 text-center">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {item.label}
                </dt>
                <dd className="mt-1 text-sm font-semibold tabular-nums tracking-tight">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </header>
  );
}
